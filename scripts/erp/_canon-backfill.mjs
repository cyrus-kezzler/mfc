/**
 * Canon backfill — mechanical fields only, from the live Shopify store.
 *
 *   node --env-file=.env.local --env-file=.env.production.local scripts/erp/_canon-backfill.mjs --dry
 *   node --env-file=.env.local --env-file=.env.production.local scripts/erp/_canon-backfill.mjs
 *
 * Populates on `drinks`: shopify_handle, choose_six_handle, lede, description
 * (Shopify descriptionHtml, stored as-is), detailed_description, glass,
 * garnish, origin_person, origin_year, origin_place.
 *
 * NEVER touches the judgement fields: serve_method, serve_note,
 * rest_weeks_confirmed, rest_confirmed_on, ownable_truth, never_say,
 * label_variance_note, garnish_supplied, garnish_supplied_note. Those are
 * Cyrus's to fill; they stay NULL here.
 *
 * Parsing policy (glass/garnish from custom.perfect_serve; origin_* from
 * custom.created_by): there is no free-prose parser in this file. Each parsed
 * value below was extracted BY HAND from the live metafield on 15 Aug 2026 and
 * carries the exact source string it came from. At run time the script
 * re-reads the metafield and verifies it still equals the recorded source;
 * if the store has drifted, the parsed values for that drink are demoted to
 * NULL and reported, never written from a stale reading. A NULL is correct;
 * a guess is a defect.
 *
 * Auth: SHOPIFY_ADMIN_TOKEN (the Canon custom-app token, scopes include
 * read_products) if set, else the same client_credentials grant as
 * src/lib/shopify.ts (SHOPIFY_CLIENT_ID/SECRET — note that app's token has NO
 * read_products scope as of 15 Aug 2026, so the env token is required in
 * practice; the fallback exists so the failure mode is a loud scope error).
 *
 * Handle resolution: every handle is resolved against Shopify in this same
 * run, and every write names the drink and handle it wrote to (standing rule
 * since the 14 Aug wrong-product incident). Any unresolvable handle aborts
 * the whole run before a single write.
 */

import { neon } from "../../node_modules/@neondatabase/serverless/index.mjs";

const DRY = process.argv.includes("--dry");

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "mfclondon.myshopify.com";
const API_VERSION = "2024-10";
const CHOOSE_SIX_URL = "https://mfc-batch-calculator.vercel.app/api/choose-six/drinks";

// ── The slug → Shopify handle map (19 Shopify-backed drinks) ────────────────
const HANDLE_BY_SLUG = {
  "baby-otis": "baby-otis-cuban-rum-manhattan",
  "cold-brew-negroni": "cold-brew-negroni",
  "corpse-reviver": "corpse-reviver-no-blue",
  dempsey: "dempsey",
  "desert-negroni": "desert-negroni",
  "espresso-martini": "espresso-martini",
  "gibson-martini": "gibson-martini",
  "lychee-martini": "lychee",
  manhattan: "manhattan",
  margarita: "margarita",
  "naked-and-famous": "naked-famous",
  negroni: "negroni",
  "pisco-martini": "piscomartini",
  "red-hook": "red-hook",
  "rum-old-fashioned": "rumoldfashioned",
  "sakura-martini": "sakura-martini",
  trident: "trident",
  tuxedo: "tuxedo",
  vesper: "vesper",
};

// Fortnum & Mason own-label: no Shopify product. shopify_handle stays NULL.
const FM_SLUGS = new Set(["espresso-daiquiri", "robin-roy", "apples-and-pears", "christmas-gingertini"]);
// Archived: skipped entirely.
const ARCHIVED_SLUGS = new Set(["clementini", "griotte", "apple-crumble", "autumn-nectar"]);

// ── Hand-curated parses, each pinned to its exact live source string ────────
// glass/garnish come from custom.perfect_serve; origin_* from custom.created_by.
// A null with a `why` is a deliberate decision, recorded for the report.
// Note the curly apostrophes (’) — they are what the store actually holds.
const PARSE = {
  "baby-otis": {
    psSource: "Serve over ice in a rocks glass. Garnish with a lime wheel.",
    glass: "Rocks glass",
    garnish: "Lime wheel",
    cbSource: "A Myatt’s Fields adaptation of the Manhattan.",
    person: null,
    year: null,
    place: null,
    why: "created_by is a house-adaptation line: no person, year or place stated.",
  },
  "cold-brew-negroni": {
    psSource:
      "Twenty minutes in the freezer, then straight up into a chilled coupe. No garnish. Ice would only dilute the coffee.",
    glass: "Coupe",
    garnish: "None",
    cbSource: "Myatt’s Fields Cocktails, London.",
    person: null,
    year: null,
    place: "London",
    why: "creator is the house, not a person; no year stated. Garnish 'None' is the metafield's explicit 'No garnish', not an absence.",
  },
  "corpse-reviver": {
    psSource: "Straight from the freezer into a chilled coupe, with a lemon twist.",
    glass: "Coupe",
    garnish: "Lemon twist",
    cbSource:
      "After Harry Craddock’s Corpse Reviver No. 2, The Savoy, London, 1930. Updated by Jacob Briars, Queenstown, New Zealand, 2007.",
    person: null,
    year: null,
    place: null,
    why: "two-stage attribution (Craddock/Savoy/1930 and Briars/2007): picking one origin is a judgement call, needs a human.",
  },
  dempsey: {
    psSource: "Serve straight up in a chilled coupe. No garnish required.",
    glass: "Coupe",
    garnish: "None",
    cbSource: "Created to mark the Dempsey-Carpentier fight, New York, 1921.",
    person: null,
    year: "1921",
    place: "New York",
    why: "no creator named, only the occasion. Garnish 'None' is the explicit 'No garnish required'.",
  },
  "desert-negroni": {
    psSource: "Pour over a large ice cube in a rocks glass. Garnish with a lime twist.",
    glass: "Rocks glass",
    garnish: "Lime twist",
    cbSource: "A Myatt’s Fields adaptation of the Negroni.",
    person: null,
    year: null,
    place: null,
    why: "created_by is a house-adaptation line: no person, year or place stated.",
  },
  "espresso-martini": {
    psSource:
      "Shake hard over ice for twenty seconds. Single-strain into a chilled coupe. Three coffee beans on top.",
    glass: "Coupe",
    garnish: "Three coffee beans",
    cbSource: "Dick Bradsell, Soho Brasserie, London, 1983.",
    person: "Dick Bradsell",
    year: "1983",
    place: "Soho Brasserie, London",
  },
  "gibson-martini": {
    psSource:
      "Straight from the freezer into a chilled coupe. No garnish. The onion is soaked into the gin and then filtered out, so the savoury note is already in the bottle.",
    glass: "Coupe",
    garnish: "None",
    cbSource: "First attributed to the Bohemian Club, San Francisco, circa 1895.",
    person: null,
    year: "circa 1895",
    place: "Bohemian Club, San Francisco",
    why: "attributed to a club, not a person. Garnish 'None' is the explicit 'No garnish'.",
  },
  "lychee-martini": {
    psSource: "Serve straight up in a chilled coupe. Garnish with a lychee or a rose petal.",
    glass: "Coupe",
    garnish: "Lychee or rose petal",
    cbSource: "Clay, New York City, circa 2001.",
    person: null,
    year: "circa 2001",
    place: "New York City",
    why: "'Clay' is ambiguous between a bartender and the NYC venue of that name: person left NULL, needs a human. Garnish stored as the metafield's verbatim either/or.",
  },
  manhattan: {
    psSource:
      "Stir over ice, then strain into a chilled coupe or Nick and Nora glass with a speared Luxardo cherry. This one does not go in the freezer: drinks carrying Angostura do not take kindly to it. The instructions are on the back label.",
    glass: "Coupe or Nick and Nora",
    garnish: "Speared Luxardo cherry",
    cbSource: "Manhattan Club, New York, circa 1880.",
    person: null,
    year: "circa 1880",
    place: "Manhattan Club, New York",
    why: "attributed to a club, not a person. Glass stored as the metafield's verbatim either/or.",
  },
  margarita: {
    psSource: "Twenty minutes in the freezer. Straight up into a chilled coupe. No salt on the rim.",
    glass: "Coupe",
    garnish: null,
    cbSource: "Origin disputed, Mexico and the American Southwest, circa 1938.",
    person: null,
    year: "circa 1938",
    place: null,
    why: "perfect_serve never states a garnish ('no salt on the rim' is a serve note, not a garnish ruling): garnish needs a human. Origin place is explicitly disputed: place needs a human.",
  },
  "naked-and-famous": {
    psSource: "Serve straight up in a chilled coupe. No garnish required.",
    glass: "Coupe",
    garnish: "None",
    cbSource: "Joaquín Simó, Death & Co., New York, 2011.",
    person: "Joaquín Simó",
    year: "2011",
    place: "Death & Co., New York",
  },
  negroni: {
    psSource:
      "Pour over a large ice cube in a rocks glass. Garnish with an orange slice or expressed orange peel.",
    glass: "Rocks glass",
    garnish: "Orange slice or expressed orange peel",
    cbSource: "Count Camillo Negroni, Caffè Casoni, Florence, 1919.",
    person: "Count Camillo Negroni",
    year: "1919",
    place: "Caffè Casoni, Florence",
    why: "garnish stored as the metafield's verbatim either/or.",
  },
  "pisco-martini": {
    psSource: "Serve straight up in a chilled coupe. Garnish with a lemon twist.",
    glass: "Coupe",
    garnish: "Lemon twist",
    cbSource: "Ivy Mix, Leyenda, Brooklyn, 2015.",
    person: "Ivy Mix",
    year: "2015",
    place: "Leyenda, Brooklyn",
  },
  "red-hook": {
    psSource:
      "Serve straight up in a chilled Nick and Nora or coupe glass. Garnish with a Luxardo cherry.",
    glass: "Nick and Nora or coupe",
    garnish: "Luxardo cherry",
    cbSource: "Vincenzo Errico, Milk & Honey, New York, circa 2003.",
    person: "Vincenzo Errico",
    year: "circa 2003",
    place: "Milk & Honey, New York",
    why: "glass stored as the metafield's verbatim either/or.",
  },
  "rum-old-fashioned": {
    psSource:
      "Serve over one large piece of ice in a rocks glass, with a wide strip of lime peel.",
    glass: "Rocks glass",
    garnish: "Wide strip of lime peel",
    cbSource: "A Myatt’s Fields adaptation of the Old Fashioned, attributed to Jerry Thomas, 1862.",
    person: null,
    year: null,
    place: null,
    why: "the attribution (Jerry Thomas, 1862) belongs to the parent Old Fashioned, not this drink: origin fields need a human ruling.",
  },
  "sakura-martini": {
    psSource:
      "Serve straight up in a chilled coupe, with the salted cherry blossom on top. The blossom comes in the box with the 250ml. The miniatures do not carry one.",
    glass: "Coupe",
    garnish: "Salted cherry blossom",
    cbSource: "Kenta Goto, Bar Goto, New York City, 2015.",
    person: "Kenta Goto",
    year: "2015",
    place: "Bar Goto, New York City",
  },
  trident: {
    psSource: "Serve over ice in a rocks glass. Garnish with a lemon twist.",
    glass: "Rocks glass",
    garnish: "Lemon twist",
    cbSource: "Robert Hess, circa 2002.",
    person: "Robert Hess",
    year: "circa 2002",
    place: null,
    why: "created_by states no place.",
  },
  tuxedo: {
    psSource: "Serve straight up in a chilled coupe. Garnish with a lemon twist.",
    glass: "Coupe",
    garnish: "Lemon twist",
    cbSource: "Tuxedo Club, New York, circa 1893.",
    person: null,
    year: "circa 1893",
    place: "Tuxedo Club, New York",
    why: "attributed to a club, not a person.",
  },
  vesper: {
    psSource:
      "Stir over ice until properly cold, then strain into a chilled coupe with a thin slice of lemon peel. Not a freezer drink: there is no water in the recipe, so the ice has to supply it.",
    glass: "Coupe",
    garnish: "Thin slice of lemon peel",
    cbSource: "Ian Fleming, Casino Royale, 1953.",
    person: "Ian Fleming",
    year: "1953",
    place: null,
    why: "'Casino Royale' is the novel, not a place: place stays NULL.",
  },
};

// ── Shopify auth (same credentials chain as src/lib/shopify.ts) ─────────────
async function getShopifyToken() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  const id = process.env.SHOPIFY_CLIENT_ID;
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("No SHOPIFY_ADMIN_TOKEN and no SHOPIFY_CLIENT_ID/SECRET in env");
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  if (!res.ok) throw new Error(`Shopify token error ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function shopifyGraphql(token, query, variables) {
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

const PRODUCT_QUERY = `query($h: String!) {
  productByHandle(handle: $h) {
    id handle title status descriptionHtml
    lede: metafield(namespace: "custom", key: "lede") { value }
    dd: metafield(namespace: "custom", key: "detailed_description") { value }
    ps: metafield(namespace: "custom", key: "perfect_serve") { value }
    cb: metafield(namespace: "custom", key: "created_by") { value }
  }
}`;

const show = (v, max = 100) => {
  if (v === null || v === undefined) return "NULL";
  const one = String(v).replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max)}… (${one.length} chars)` : JSON.stringify(one);
};

const FIELDS = [
  "shopify_handle",
  "choose_six_handle",
  "lede",
  "description",
  "detailed_description",
  "glass",
  "garnish",
  "origin_person",
  "origin_year",
  "origin_place",
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  const sql = neon(process.env.DATABASE_URL);
  const needsHuman = [];
  const disagreements = [];
  const skipped = [];

  // 1. The drinks table, as it stands.
  const drinkRows = await sql.query(
    `SELECT id, slug, name, status, ${FIELDS.join(", ")} FROM drinks ORDER BY id`
  );
  const bySlug = new Map(drinkRows.map((r) => [r.slug, r]));

  // 2. Choose Six live endpoint.
  const csRes = await fetch(CHOOSE_SIX_URL);
  if (!csRes.ok) throw new Error(`Choose Six endpoint HTTP ${csRes.status}`);
  const csHandles = new Set((await csRes.json()).drinks.map((d) => d.handle));
  console.log(`Choose Six endpoint: ${csHandles.size} drinks live.`);
  if (csHandles.size !== 19) throw new Error(`Expected 19 Choose Six drinks, got ${csHandles.size}`);

  // 3. Resolve every handle against Shopify. All-or-nothing: any failure aborts.
  const token = await getShopifyToken();
  const products = new Map(); // slug -> product
  const resolutionFailures = [];
  for (const [slug, handle] of Object.entries(HANDLE_BY_SLUG)) {
    const data = await shopifyGraphql(token, PRODUCT_QUERY, { h: handle });
    const p = data.productByHandle;
    if (!p) {
      resolutionFailures.push(`${slug}: handle "${handle}" does not resolve on ${SHOPIFY_DOMAIN}`);
      continue;
    }
    products.set(slug, p);
    if (!bySlug.has(slug)) resolutionFailures.push(`${slug}: not present in the drinks table`);
  }
  if (resolutionFailures.length > 0) {
    console.error("\nHANDLE RESOLUTION FAILED — nothing was or will be written:");
    for (const f of resolutionFailures) console.error("  " + f);
    process.exit(1);
  }
  console.log(`Resolved all ${products.size} handles against ${SHOPIFY_DOMAIN}.\n`);

  // 4. Build intended writes.
  const plans = [];
  for (const row of drinkRows) {
    if (ARCHIVED_SLUGS.has(row.slug)) {
      skipped.push(`${row.slug}: archived, skipped`);
      continue;
    }
    if (FM_SLUGS.has(row.slug)) {
      skipped.push(`${row.slug}: F&M own-label, no Shopify product, shopify_handle stays NULL, skipped`);
      continue;
    }
    const p = products.get(row.slug);
    if (!p) {
      // A drink that is neither F&M, archived, nor mapped: refuse silently writing nothing — name it.
      skipped.push(`${row.slug}: NOT IN THE HANDLE MAP — left untouched, flag to a human`);
      needsHuman.push(`${row.slug}: drink exists in DB but has no entry in the handle map`);
      continue;
    }

    if (p.status !== "ACTIVE") disagreements.push(`${row.slug}: Shopify product status is ${p.status}, DB says ${row.status}`);
    if (p.title !== row.name)
      disagreements.push(`${row.slug}: DB name "${row.name}" vs Shopify title "${p.title}" (informational, not written anywhere)`);

    const parse = PARSE[row.slug] ?? {};
    const livePs = p.ps?.value ?? null;
    const liveCb = p.cb?.value ?? null;
    let { glass = null, garnish = null, person = null, year = null, place = null } = parse;

    if (parse.psSource !== undefined && livePs !== parse.psSource) {
      glass = null;
      garnish = null;
      needsHuman.push(
        `${row.slug}: perfect_serve has changed since the 15 Aug hand-parse — glass/garnish written NULL. Live: ${show(livePs, 140)}`
      );
    }
    if (parse.cbSource !== undefined && liveCb !== parse.cbSource) {
      person = null;
      year = null;
      place = null;
      needsHuman.push(
        `${row.slug}: created_by has changed since the 15 Aug hand-parse — origin_* written NULL. Live: ${show(liveCb, 140)}`
      );
    }
    if (parse.why) needsHuman.push(`${row.slug}: ${parse.why}`);

    plans.push({
      id: row.id,
      slug: row.slug,
      handle: p.handle,
      values: {
        shopify_handle: p.handle,
        choose_six_handle: csHandles.has(p.handle) ? p.handle : null,
        lede: p.lede?.value ?? null,
        description: p.descriptionHtml ?? null,
        detailed_description: p.dd?.value ?? null,
        glass,
        garnish,
        origin_person: person,
        origin_year: year,
        origin_place: place,
      },
    });
  }

  // 5. Print the plan.
  for (const plan of plans) {
    console.log(`── ${plan.slug} (drink id ${plan.id}) ← Shopify handle "${plan.handle}"`);
    for (const f of FIELDS) console.log(`   ${f.padEnd(21)} ${show(plan.values[f])}`);
  }
  console.log("\nSkipped:");
  for (const s of skipped) console.log("  " + s);

  if (DRY) {
    console.log(`\nDRY RUN — nothing written. ${plans.length} drinks would be updated.`);
  } else {
    // 6. Write, one single UPDATE per drink, then read back.
    console.log("\nWriting…");
    let mismatches = 0;
    for (const plan of plans) {
      const sets = FIELDS.map((f, i) => `${f} = $${i + 1}`).join(", ");
      const params = FIELDS.map((f) => plan.values[f]);
      const updated = await sql.query(
        `UPDATE drinks SET ${sets}, updated_at = now() WHERE id = $${FIELDS.length + 1} RETURNING slug`,
        [...params, plan.id]
      );
      if (updated.length !== 1 || updated[0].slug !== plan.slug) {
        throw new Error(`UPDATE for id ${plan.id} hit ${updated.length} rows (${JSON.stringify(updated)}) — expected exactly ${plan.slug}`);
      }

      // Read-back: fresh SELECT, strict equality against intent, field by field.
      const [back] = await sql.query(`SELECT ${FIELDS.join(", ")} FROM drinks WHERE id = $1`, [plan.id]);
      console.log(`── wrote ${plan.slug} (id ${plan.id}); read-back:`);
      for (const f of FIELDS) {
        const ok = (back[f] ?? null) === (plan.values[f] ?? null);
        if (!ok) mismatches += 1;
        console.log(`   ${ok ? "OK " : "MISMATCH"} ${f.padEnd(21)} ${show(back[f])}`);
      }
    }
    console.log(
      `\n${plans.length} drinks written and read back${mismatches === 0 ? ", all fields verified equal." : `; ${mismatches} FIELD MISMATCHES — investigate now.`}`
    );
    if (mismatches > 0) process.exitCode = 1;
  }

  // 7. NULLs and disagreements.
  console.log("\nFields left NULL / needing a human:");
  for (const n of needsHuman) console.log("  " + n);
  console.log("\nShopify vs DB disagreements (informational):");
  if (disagreements.length === 0) console.log("  none");
  for (const d of disagreements) console.log("  " + d);
  console.log(
    "\nUntouched judgement fields (by design): serve_method, serve_note, rest_weeks_confirmed, rest_confirmed_on, ownable_truth, never_say, label_variance_note, garnish_supplied, garnish_supplied_note."
  );
}

main().catch((err) => {
  console.error("FATAL — run aborted:", err);
  process.exit(1);
});
