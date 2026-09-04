# Back Bar — audit and roadmap

**Date:** 4 September 2026
**Status:** Live plan. Supersedes `erp-spec.md` v0.2 as the statement of scope.
**Owners:** Cyrus (Owner), Clemency (Operator)

Every number in the audit below was read from the live database or the repo on
4 September 2026. Nothing here is remembered or estimated. This document follows
the rule in `revenue-provenance.md`: a figure that cannot be traced does not
appear.

---

## 1. What Back Bar is

Back Bar keeps track of four things, and they are four different surfaces:

| Surface | The question it answers |
|---|---|
| **Make** | What is each drink made of, and how do we make it? |
| **Sell** | What do we sell, to whom, at what price? |
| **Buy** | What do we buy, from whom, at what cost? |
| **Analyse** | Is any of it working? |

Underneath all four sits one thing they all depend on: **the chain from
component to recipe to SKU to price, with every figure sourced and dated.**

That chain is the bedrock. It is also, as it happens, the part that is already
built and populated.

**For the next six months we build the bedrock and nothing else.** The four
surfaces come afterwards, one at a time, each taking advantage of a bedrock that
is by then beyond argument.

---

## 2. Where we are — 4 September 2026

### 2.1 What is real, populated, and trustworthy

This is the granite. All counts read live from the database on 4 Sept 2026.

| Table | Rows | What it means |
|---|---|---|
| `components` | 110 | The buying master — every ingredient, dry good, packaging item |
| `component_price_history` | 116 | Costs are versioned, not overwritten |
| `drinks` | 27 | The drinks canon |
| `recipes` | 40 | 31 current, 9 historical versions retained |
| `recipe_lines` | 157 | Percentage-based, all summing to 100 |
| `skus` | 104 | The sellable range across the size ladder |
| `sku_components` | 392 | Bill of materials per SKU |
| `sku_prices` | 129 | Wholesale and RRP with effective dates |
| `clients` | 3 | MFC, F&M, Cripps |

Alongside the data, four things are genuinely well built:

1. **The provenance rule** (`docs/revenue-provenance.md`). Every figure carries a
   `source` and an `asOf`. Anything hand-typed renders a visible warning.
   Partial years are labelled as partial. This exists because a fabricated
   revenue table nearly caused us to defund DTC — the only channel that has ever
   demonstrated it can scale. The fix was structural rather than numerical, and
   that instinct is the most valuable asset in the project.

2. **Gate 1 — declared ABV against the label.** 95 of 104 SKUs carry a declared
   ABV with a source and a note. Built 30 Aug 2026.

3. **The recipe integrity audit** (`scripts/erp/audit-recipes.ts`). Read-only.
   All 40 recipes sum to 100% with zero failures. The script re-derives ABV
   independently and cross-checks itself against the app's own `canon.ts` —
   31 of 31 current recipes matched. A verification tool that verifies itself is
   a rare and good thing.

4. **The MCP connector.** Deployed, OAuth 2.1 plus bearer, exposing drinks,
   recipes, ingredients, pricing and revenue to trusted agents.

The app is live at `admin.myattsfields.com`, password-gated, and `tsc --noEmit`
passes clean.

### 2.2 What was built but never used

| Table | Rows | Shipped |
|---|---|---|
| `suppliers` | **0** | Slice 1, ~May 2026 |
| `customers` | **0** | — |
| `wholesale_orders` | **0** | Migration 0011, Aug 2026 |
| `wholesale_order_lines` | **0** | Aug 2026 |
| `wholesale_order_bookings` | **0** | Aug 2026 |
| `purchase_commitments` | **0** | Aug 2026 |

Six tables, no rows. `suppliers` has been shipped and empty for four months.
These were built ahead of a workflow that never arrived. **This is the single
clearest lesson in the repository: we built cabinets before we knew what went
in them.**

### 2.3 What was specced, is understood, and was never built

From `erp-spec.md` v0.2, all still absent from the codebase — no schema, no
routes, no code:

- Inbounds (receive a delivery, update cost and stock)
- Inventory lots and FIFO consumption
- Production runs
- Bottle serials and label printing
- Price lists and quotes
- The dashboard tile for **% revenue by channel** — which the spec itself calls
  "the single most important number in this build"

These are well understood. They are not lost work. They are parked (§4).

### 2.4 Known defects and debt

*This section records the state at the moment of the audit. Items fixed in
week 1 are marked ✅ rather than deleted, so the record of what was wrong
survives the fixing of it.*

**Data gaps (4 found, all small):**
- `Chinotto Nero` has no ABV recorded. It appears in all three Clementini
  recipes, so computed ABV is understated on our F&M flagship.
- 9 of 104 SKUs have no declared ABV.
- 6 active components have no unit cost, or a cost of zero.
- 29 of 40 recipes fall outside the 8–17% water band. Probably fine — the band
  may simply be wrong for freezer-door serves — but it has never been ruled on.

**The audit tool is already stale.** ✅ *Fixed, week 1.* `audit-recipes.ts` was
uncommitted and reported "0 of 40 recipes have a declared ABV to check against —
no such column exists." That was wrong: `skus.declared_abv` exists and is
populated on 95 rows. The script was written 28 Aug, the column landed 30 Aug,
and the tool that proves our data is correct was itself incorrect. It now reads
the column, and the first thing it found is §6.1.

**Repository floor:** — all ✅ *fixed, week 1*
- 4 × `DELETE-ME_*.txt` files in the project root
- `tmp_q_components.cjs` in the root
- ~60 `_`-prefixed one-off scripts and `.log` files committed under `scripts/erp/`
  (68 of them, moved to `scripts/archive/`)
- 13 stale branches, the oldest from April (15 deleted; 3 kept, see below)
- 5 ESLint errors (4 × setState-in-effect, 1 × `require()` in the stray temp file)

Three branches were deliberately kept: `fix/boxset-gift-card-product` carries one
unmerged commit, and `claude/tender-wilbur-cc56bb` and
`claude/xenodochial-heisenberg-d6e7c4` have uncommitted work sitting in their
worktrees (an unfinished "headlines" feature, and 13 modified files). Someone
should decide what those are worth before they are lost.

**Documentation that misleads:** — all ✅ *fixed, week 1*
- `README.md` is still `create-next-app` boilerplate with an MCP section bolted on
- The `/erp` landing page lists Recipes and Cost rollup as "Planned". They are
  built. The page lies to the people using it.
- `docs/erp-dogfood.md` tells Clemency to `cd` into a worktree path that no
  longer applies, and never mentions `AUTH_SECRET`, without which local login
  throws an error — which is why local dogfooding kept stalling.

### 2.5 The diagnosis

The spec was good and the build ignored its own build order.

Spec §15 laid out: Foundations → Inbounds → Recipes → Cost rollup → Production
runs and serials → Price lists → Dashboard.

What actually happened: Foundations shipped and went unused; the build jumped to
recipes, the canon, SKUs and pricing — which turned out genuinely valuable and
is now the crown jewel — then went sideways into Finances, Sales, Strategy and
the MCP connector, and never came back for Inbounds, Production, Serials or the
Dashboard.

So the **data** half of the spec got built. The **operations** half never
started. That is precisely why `suppliers` has no rows: a supplier is only
useful once inbounds exist.

Two real incidents happened along the way, and they share one failure mode —
data entered without a check at the moment of entry, then trusted downstream:

1. A hand-typed revenue split was read as source and nearly caused DTC to be
   defunded. Real 2020 DTC was understated by a factor of three and a half.
2. Two of two recipes entered on 15 Jul 2026 were materially wrong. Nothing
   compared them against anything when they were written, and nobody had checked
   the rest.

Both produced a structural control rather than a corrected number. **That
pattern — incident, then a mechanism that makes the incident impossible — is
the thing to build the next year on.**

The reason it has felt like shifting sands is simpler than it looks: there was
no release cadence, no definition of done, and no cutover, so every session
began by re-deciding scope. Sixty one-off scripts is the fingerprint of exactly
that.

---

## 3. The end state

> **Back Bar knows what every Myatt's Fields drink is made of, what it costs to
> make today, and what it should sell for in every channel — and it will not
> show you a number it cannot trace.**
>
> On that bedrock sit four surfaces: **Make**, **Sell**, **Buy** and
> **Analyse**. Clemency and Cyrus both work in it daily, in a browser, without
> a terminal. Every figure carries its source and its date. Nothing is
> remembered. Nothing is retyped.

The six months this document covers build the bedrock only. The four surfaces
are the years after.

---

## 4. What is parked, explicitly

Parked is not cancelled. It means: we are not building it, not designing it, and
not carrying it in our heads until we choose to unpark it. Each has a stated
interim answer so nothing is left dangling.

| Parked | Interim answer |
|---|---|
| CRM and outbound tracking | A spreadsheet. Who we contacted, what we sent. |
| Understanding customers | QuickBooks, read with Claude, as the source of truth. |
| One view across Shopify, Amazon and wholesale | Later. QuickBooks holds the totals in the meantime. |
| Inbounds, inventory, production runs, bottle serials | Later. The batch spreadsheet and paper labels continue. |
| Price lists, quotes, PDFs | Later. Current manual process continues. |
| % revenue by channel | Blocked anyway on the £92k unclassified bucket — John at Fathom. |
| Shopify and QuickBooks write integration | Later. |

The six empty tables in §2.2 stay in the schema. They cost nothing to leave and
migrating them out is churn for its own sake — but they are dead until unparked,
and the `/erp` page will say so.

---

## 5. Cadence

- **Ship every Friday.** A release, however small, with a tag.
- **Five themed weeks, then a sixth with no new scope** — catch-up, dogfooding,
  and re-planning the next cycle.
- **If it is not done by Thursday night, it is cut, not slipped.** Scope moves,
  the date does not. This is the rule that the last four months lacked.
- **Detail decays with distance, honestly.** Cycle 1 is a real backlog. Cycle 2
  is a sketch. Cycles 3 and 4 are themes. Anything presented as a firm weekly
  commitment six months out would be fiction.

**Definition of done, every week:**
1. `npm run typecheck` clean
2. `npm run lint` clean
3. `npm run audit` runs, and every failure it reports is one we have seen and
   accepted — never one we silenced. Green is the goal from week 2 onward; it
   is red today for a real reason (§6.1).
4. Deployed to `admin.myattsfields.com`
5. Tagged, with one paragraph saying what changed and what it means

---

## 6. Cycle 1 — Honesty and floor (4 Sept – 16 Oct)

The theme: **make what already exists trustworthy, honest about itself, and
usable.** No new features in this cycle at all.

### Week 1 — "Tell the truth" — ships Friday 11 September

This is the answer to "where could we be by next Friday." Every item is small
and verifiable, and together they convert *I am not sure what I have* into
*I know exactly what I have.*

1. **Make the `/erp` landing page honest.** Recipes, cost rollup, SKUs and
   prices marked as built. Inbounds, production, serials marked **Parked**, not
   "Planned", with a link to §4 of this document.
2. **Fix the audit tool.** Point `audit-recipes.ts` at `skus.declared_abv`,
   commit it, and wire it up as `npm run audit`.
3. **Lint clean.** Fix the 4 setState-in-effect errors; delete
   `tmp_q_components.cjs` and the 4 `DELETE-ME_*.txt` files.
4. **Clear the floor.** Move the ~60 `_`-prefixed scripts and `.log` files out
   of `scripts/erp/` into `scripts/archive/` (or delete them — a one-off script
   that has run is history, and git already has it).
5. **Rewrite `README.md`.** What Back Bar is, the four surfaces, what is real,
   what is parked.
6. **Fix the docs.** Mark `erp-spec.md` superseded by this file. Correct the
   stale worktree path in `erp-dogfood.md`.
7. **Branch hygiene.** Delete the 13 stale branches.
8. **The top nav becomes the four surfaces** — Make, Buy, Sell, Analyse — so the
   app states the model instead of listing whatever got built. Added mid-week at
   Cyrus's request; it belongs here because it is the same job as the rest of the
   week: making the thing honest about itself.
9. **Tag `v0.1`.**

**Done when:** typecheck clean, lint clean, `npm run audit` running and its
failures understood, README true, tagged, deployed.

### 6.1 What week 1 found — Gate 1 fails on 19 recipes

Fixing the audit tool immediately produced the largest finding of the audit, and
it is a live compliance question rather than a tidiness one.

Of the 25 recipes that can be checked against a label figure, **19 are further
than the 0.3-point legal tolerance from what the bottle says**, several by a
wide margin: Naked & Famous by 6.40 points, Corpse Reviver by 5.76, Gibson
Martini by 4.74, Baby Otis by 3.89, Sakura Martini by 3.18. A further 15 recipes
are UNVERIFIED — no SKU carries a label figure at all, so nobody has read those
bottles.

**It is not yet known which side is wrong,** and that distinction is the whole
job. The gaps run in both directions, and 29 of 40 recipes record a water
percentage outside the 8–17% band, many of them at 0.0% — meaning dilution is
very likely not modelled in the recipe at all. Where that is so, the *computed*
figure is the unreliable one, not the label.

This is the top of week 2. It needs a ruling per drink, not a bulk edit, and
under no circumstances a copy of the computed value into the declared column —
that single act is what `skus.declared_abv` exists to prevent.

### Week 2 — Close the data gaps (18 Sept)
Chinotto Nero's ABV. The 9 SKUs missing a declared ABV. The 6 components with no
cost. Rule on the 8–17% water band — either fix the band or fix the recipes.
Ends with: every active component has a price with a source, and every SKU has a
declared ABV.

### Week 3 — Provenance on costs (25 Sept)
Extend the `revenue-provenance.md` rule from revenue to costing. Every cost in
the UI shows its source and its date. Placeholder prices are visibly flagged
wherever they appear, including in MCP responses.

### Week 4 — The rollup is inspectable (2 Oct)
Spec §12 asked for this and it was never built: *"Where did this £14.83 come
from?" → click → see the rollup tree.* Component costs, quantities, wastage,
each step visible.

### Week 5 — The price review surface (9 Oct)
One screen: every SKU with its current cost, current price, resulting margin,
when the price was set, and a flag when cost has moved since.

### Week 6 — Slack (16 Oct)
No new scope. Clemency dogfoods the whole cycle. Fix what that turns up.
Re-plan cycle 2 from what actually hurt.

---

## 7. Cycle 2 — Clemency-proof (19 Oct – 27 Nov) — sketch

**Theme: no terminal, ever.** The measure of success is that the one-off script
stops being the tool of choice, because a screen does the job instead.

- Component price entry in-app, by pack format (per the slice 1 dogfood
  feedback: pack-format cost entry, all-caps labels)
- Gate 1 enforced at write time rather than at audit time — a wrong recipe
  should be refused when saved, not found later
- New drink and new SKU, end to end, in the browser
- Price changes with history and a stated reason
- A weekly "what moved" view: costs that changed, prices now stale
- Slack week

## 8. Cycle 3 — Hold the line (30 Nov – 15 Jan) — themes

Guard rails and seasonal load. The audit running automatically rather than when
remembered. Backup and restore actually tested. The F&M seasonal editions
workload. Christmas absorbed by the slack weeks.

## 9. Cycle 4 — Sharpen (18 Jan – 26 Feb) — themes

Whatever the first three cycles prove is missing. Likely candidates:
client-specific price lists, cost-movement alerts, the 100/300/600ml rebrand
groundwork.

## 10. Early March 2027 — the fork

The bedrock is done and beyond argument. Review, then choose which surface to
build first on top of it: **Make**, **Sell**, **Buy** or **Analyse**.

That decision belongs to March, with six months of real usage behind it. Not to
today.

---

*Written 4 September 2026. Supersedes `erp-spec.md` v0.2 as the statement of
scope. `erp-spec.md` is retained as the design reference for parked work.*
