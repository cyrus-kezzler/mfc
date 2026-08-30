/**
 * Drink canon derivations: ABV, water percentage, rest-weeks floor.
 *
 * These three are COMPUTED at read time and never stored, on the same
 * principle as the rule price in pricing.ts: a number a formula produced and a
 * fact someone asserted must never share a column. The asserted counterparts
 * live on `drinks` (serve_method, rest_weeks_confirmed) and the computed ones
 * live here, so a disagreement between them is visible instead of silently
 * overwritten.
 *
 * What each figure is for:
 *
 * - ABV is the label-facing number, summed from the current recipe. A
 *   component with a NULL abv is NOT treated as zero — it is named in the
 *   result so the caller can refuse to publish. Silently absorbing a null is
 *   how a wrong number gets printed on a label.
 *
 * - Water percentage is a DIAGNOSTIC, not a decider. It was tested as a rule
 *   for the serve on 15 Aug 2026 and rejected (Cold Brew Negroni: no water,
 *   freezes well; Negroni: no water, does not). It resolves recursively
 *   through component_recipes, because Myatt's Sours is 94.7% water and only
 *   260 of those parts are a top-level line named Water — the rest hides one
 *   level down in the phosphoric dilution stock.
 *
 * - The rest floor is a FLOOR, not the answer. Vermouth-or-sherry is a
 *   trigger, not a limit (Cyrus, 14 Aug 2026): drinks without either (the
 *   Dempsey, the Rum Old Fashioned) are aged anyway. The confirmed figure is
 *   rest_weeks_confirmed on the drink, typed by Cyrus after tasting.
 */

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import {
  clients,
  components,
  componentRecipes,
  recipes,
  recipeLines,
  skus,
} from "@/db/schema";

/**
 * Components whose presence in a recipe triggers the six-week rest floor.
 *
 * An explicit, reviewable list of exact names, deliberately NOT a regex: a
 * loose pattern could quietly catch an unrelated future component, and a rest
 * rule that fires by accident is worse than one that has to be extended by
 * hand. Aromatised wine counts as vermouth per Cyrus's 14 Aug 2026 ruling,
 * which is why Lillet Blanc and Cocchi Americano are here. When a new
 * vermouth, sherry or aromatised wine enters the register, add its exact name.
 */
export const REST_TRIGGER_COMPONENT_NAMES: readonly string[] = [
  "Noilly Prat",
  "Cocchi Torino",
  "Cocchi Americano",
  "Carpano Antica Formula Vermouth",
  "Punt e Mes",
  "Lillet Blanc",
  "Manzanilla",
  "Fino Sherry",
] as const;

/** The six-week floor applied when a rest trigger is present. */
export const REST_FLOOR_WEEKS = 6;

/**
 * How deep waterPct will follow component_recipes nesting before giving up.
 * The real data is two levels (Sours -> phosphoric stock -> water); the cap
 * exists so a future accidental cycle degrades into a named problem instead
 * of a hung request.
 */
const SUB_RECIPE_DEPTH_CAP = 8;

export interface NullAbvComponent {
  componentId: number;
  name: string;
}

export interface AbvResult {
  /** % ABV of the finished drink, from the current recipe. */
  abv: number;
  /**
   * Components whose abv is NULL. Never silently zero: the sum above simply
   * has nothing to add for these, and the caller must refuse to publish while
   * this list is non-empty.
   */
  nullAbvComponents: NullAbvComponent[];
  /** Structural problems, e.g. no current recipe for this client. */
  problems: string[];
}

export interface WaterPctResult {
  /** Total water as a % of the batch, resolved through sub-recipes. */
  waterPct: number;
  problems: string[];
}

export interface CanonReport {
  drinkId: number;
  clientSlug: string;
  abv: number;
  nullAbvComponents: NullAbvComponent[];
  waterPct: number;
  /** 6 when a rest trigger is present, else null. A floor, never the answer. */
  restFloorWeeks: number | null;
  problems: string[];
}

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round(x: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

/**
 * The current recipe's lines for a drink, under the named client or the
 * default client (MFC) when none is given. Returns null with a problem string
 * when there is nothing to compute from — the callers all degrade the same
 * way, so the resolution lives once.
 */
async function currentRecipeLines(
  drinkId: number,
  clientSlug?: string,
): Promise<{ lines: { componentId: number; percentage: string }[] } | { problem: string }> {
  const clientRows = clientSlug
    ? await db.select().from(clients).where(eq(clients.slug, clientSlug))
    : await db.select().from(clients).where(eq(clients.isDefault, true));
  if (clientRows.length === 0) {
    return { problem: clientSlug ? `No client with slug "${clientSlug}"` : "No default client" };
  }
  const client = clientRows[0];

  const recipeRows = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.drinkId, drinkId),
        eq(recipes.clientId, client.id),
        eq(recipes.isCurrent, true),
      ),
    );
  if (recipeRows.length === 0) {
    return { problem: `No current recipe for drink ${drinkId} under client "${client.slug}"` };
  }

  const lines = await db
    .select()
    .from(recipeLines)
    .where(eq(recipeLines.recipeId, recipeRows[0].id));
  return { lines };
}

/**
 * ABV of the current recipe: sum of component abv x line percentage / 100.
 *
 * A NULL component abv contributes nothing to the sum AND lands in
 * nullAbvComponents, because the two failure modes must stay distinct: an
 * ingredient that genuinely carries no alcohol has abv "0.00", an ingredient
 * nobody has measured has NULL, and only the second blocks publishing.
 */
export async function abvComputed(drinkId: number, clientSlug?: string): Promise<AbvResult> {
  const resolved = await currentRecipeLines(drinkId, clientSlug);
  if ("problem" in resolved) {
    return { abv: 0, nullAbvComponents: [], problems: [resolved.problem] };
  }
  return abvFromLines(resolved.lines, await componentAbvById());
}

/** componentId -> { name, abv } for every component. One query, reused. */
export async function componentAbvById(): Promise<Map<number, { name: string; abv: string | null }>> {
  const rows = await db.select().from(components);
  return new Map(rows.map((c) => [c.id, { name: c.name, abv: c.abv }]));
}

/**
 * The summation itself, pure and synchronous: sum of component abv x line
 * percentage / 100.
 *
 * Split out from abvComputed on 30 Aug 2026 so that Gate 1 can weigh the lines
 * a person is ABOUT to save — which are not in the database yet and so cannot
 * be read back — against exactly the arithmetic the drink page will show once
 * they are. Two summations that were meant to agree and quietly drifted is a
 * failure mode worth designing out; there is now one.
 *
 * A NULL component abv contributes nothing to the sum AND lands in
 * nullAbvComponents, because the two failure modes must stay distinct: an
 * ingredient that genuinely carries no alcohol has abv "0.00", an ingredient
 * nobody has measured has NULL, and only the second blocks publishing.
 */
export function abvFromLines(
  lines: { componentId: number; percentage: string | number }[],
  compById: Map<number, { name: string; abv: string | null }>,
): AbvResult {
  const problems: string[] = [];
  const nullAbvComponents: NullAbvComponent[] = [];
  let abv = 0;

  for (const line of lines) {
    const c = compById.get(line.componentId);
    if (!c) {
      problems.push(`Recipe line references missing component ${line.componentId}`);
      continue;
    }
    if (c.abv === null) {
      nullAbvComponents.push({ componentId: line.componentId, name: c.name });
      continue;
    }
    abv += (n(c.abv) * n(line.percentage)) / 100;
  }

  return { abv: round(abv), nullAbvComponents, problems };
}

/**
 * Total water as a percentage of the batch.
 *
 * Resolved RECURSIVELY: a line's water contribution is its percentage times
 * the water fraction of its component, where an ingredient is 1 if it is the
 * Water component itself and 0 otherwise, and a sub-recipe is the
 * quantity-weighted water fraction of its children over its batch yield.
 * That is what makes Myatt's Sours come out at 94.7% — 260 parts top-level
 * water plus 50 parts phosphoric dilution stock that is itself 97.94% water,
 * over a 326.2 yield — when a name-match on top-level lines would see none
 * of it in any drink.
 *
 * Only the component literally named Water counts. The 45% phosphoric acid is
 * chemically majority water, but the canon figure is about what we added as
 * water, not a chemical assay.
 */
export async function waterPct(drinkId: number, clientSlug?: string): Promise<WaterPctResult> {
  const resolved = await currentRecipeLines(drinkId, clientSlug);
  if ("problem" in resolved) {
    return { waterPct: 0, problems: [resolved.problem] };
  }

  const problems: string[] = [];

  const allComponents = await db.select().from(components);
  const compById = new Map(allComponents.map((c) => [c.id, c]));
  const waterIds = new Set(allComponents.filter((c) => c.name === "Water").map((c) => c.id));
  if (waterIds.size === 0) {
    problems.push('No component named "Water" exists, so water cannot be resolved');
  }

  const allChildRows = await db.select().from(componentRecipes);
  const childrenByParent = new Map<number, { childComponentId: number; quantity: string }[]>();
  for (const row of allChildRows) {
    const list = childrenByParent.get(row.parentComponentId) ?? [];
    list.push(row);
    childrenByParent.set(row.parentComponentId, list);
  }

  /** Fraction of one unit of this component that is water, in [0, 1]. */
  const waterFraction = (componentId: number, depth: number): number => {
    if (waterIds.has(componentId)) return 1;
    const c = compById.get(componentId);
    if (!c) {
      problems.push(`Water resolution hit missing component ${componentId}`);
      return 0;
    }
    if (c.type !== "sub_recipe") return 0;
    if (depth >= SUB_RECIPE_DEPTH_CAP) {
      problems.push(
        `Sub-recipe nesting under "${c.name}" exceeds depth ${SUB_RECIPE_DEPTH_CAP} — cycle? Water fraction taken as 0`,
      );
      return 0;
    }
    const children = childrenByParent.get(componentId) ?? [];
    if (children.length === 0) {
      problems.push(`Sub-recipe "${c.name}" has no component_recipes rows`);
      return 0;
    }
    // Per one base batch: children carry quantities, the parent carries what
    // the batch yields. Fall back to the summed quantities when yield is
    // missing, and say so, because a wrong denominator is invisible otherwise.
    const qtySum = children.reduce((s, ch) => s + n(ch.quantity), 0);
    let denominator = n(c.batchYield);
    if (denominator <= 0) {
      problems.push(`Sub-recipe "${c.name}" has no batch_yield; using summed child quantities`);
      denominator = qtySum;
    }
    if (denominator <= 0) return 0;
    let water = 0;
    for (const ch of children) {
      water += n(ch.quantity) * waterFraction(ch.childComponentId, depth + 1);
    }
    return water / denominator;
  };

  let pct = 0;
  for (const line of resolved.lines) {
    pct += n(line.percentage) * waterFraction(line.componentId, 0);
  }

  return { waterPct: round(pct), problems };
}

/**
 * The rest floor: 6 weeks when the current recipe carries any component in
 * REST_TRIGGER_COMPONENT_NAMES, else null. Null means "no floor derives", it
 * does not mean "no rest": the answer for any drink is rest_weeks_confirmed,
 * typed by Cyrus, and this figure only exists to catch a confirmed value that
 * has somehow fallen below what a vermouth or sherry demands.
 *
 * Matches top-level lines by exact component name, resolved against the
 * register once per call. Sub-recipes are not traversed: none of the house
 * preparations contains a trigger, and hiding a vermouth inside a sub-recipe
 * would be a recipe-modelling error to fix there, not to paper over here.
 */
export async function restFloorWeeks(
  drinkId: number,
  clientSlug?: string,
): Promise<number | null> {
  const resolved = await currentRecipeLines(drinkId, clientSlug);
  if ("problem" in resolved) return null;

  const allComponents = await db.select().from(components);
  const triggerIds = new Set(
    allComponents
      .filter((c) => REST_TRIGGER_COMPONENT_NAMES.includes(c.name))
      .map((c) => c.id),
  );

  const triggered = resolved.lines.some(
    (l) => n(l.percentage) > 0 && triggerIds.has(l.componentId),
  );
  return triggered ? REST_FLOOR_WEEKS : null;
}

/**
 * All three derivations plus the null-abv list, in one call, for the
 * generators and the trust view. The problems arrays are merged and
 * de-duplicated because the three share their failure modes (no client, no
 * current recipe) and a report that repeats itself gets skimmed.
 */
export async function canonReport(drinkId: number, clientSlug?: string): Promise<CanonReport> {
  const clientRows = clientSlug
    ? await db.select().from(clients).where(eq(clients.slug, clientSlug))
    : await db.select().from(clients).where(eq(clients.isDefault, true));
  const resolvedSlug = clientRows[0]?.slug ?? clientSlug ?? "?";

  const [abv, water, floor] = await Promise.all([
    abvComputed(drinkId, clientSlug),
    waterPct(drinkId, clientSlug),
    restFloorWeeks(drinkId, clientSlug),
  ]);

  return {
    drinkId,
    clientSlug: resolvedSlug,
    abv: abv.abv,
    nullAbvComponents: abv.nullAbvComponents,
    waterPct: water.waterPct,
    restFloorWeeks: floor,
    problems: [...new Set([...abv.problems, ...water.problems])],
  };
}

// ─── Gate 1: the declared-vs-computed check ─────────────────────────────────
// Brief: Projects/Cocktails/Back Bar/`2026-08-30 declared_abv - the build brief
// and the recovered label figures [Brief].md`.
//
// Back Bar computes an ABV from the recipe. The bottle carries a printed one.
// Gate 1 refuses a recipe save that would push those two more than 0.3
// percentage points apart, which is the legal tolerance for spirit drinks.
//
// It is not a correctness check on the recipe. It is a disagreement detector:
// when it fires, two numbers that describe the same liquid do not match and
// nobody has yet established which is right. On the day it was switched on it
// fired for twelve of nineteen drinks, and that is the finding, not a bug.

/**
 * The legal tolerance for spirit drinks, in percentage points.
 *
 * STRICTLY GREATER THAN fails. Four drinks — the Desert Negroni, the Pisco
 * Martini, the Dempsey and (in the brief, though it has no Back Bar record)
 * the Negroni Starter — sit at exactly 0.3, so ">= 0.3 fails" would flip all
 * four on a rounding decision rather than on a fact. Do not loosen this to
 * >= without a ruling from Cyrus.
 */
export const GATE_1_TOLERANCE_POINTS = 0.3;

/**
 * Gap arithmetic is done on values rounded to one decimal place — the
 * precision a label is actually printed at, and the precision declared_abv is
 * stored at, numeric(4,1). Comparing a raw 27.5896 against a printed 27.6
 * would manufacture a 0.0104 discrepancy out of nothing but float tail.
 */
function toLabelPrecision(x: number): number {
  return Math.round(x * 10) / 10;
}

export type GateOneVerdict =
  /** Declared and computed agree inside tolerance. */
  | { status: "pass"; computed: number; declared: number; gap: number }
  /** They differ by more than the tolerance. The save must be refused. */
  | { status: "fail"; computed: number; declared: number; gap: number; message: string }
  /**
   * No declared figure exists, so the gate CANNOT RUN. The save is allowed and
   * the recipe is flagged unverified. This is emphatically not a pass: a NULL
   * means nobody has read the bottle, and letting it read as agreement is the
   * exact confusion the declared_abv column was built to end.
   */
  | { status: "unverified"; computed: number; declared: null; gap: null; reason: string };

/**
 * Run Gate 1 for one computed ABV against one declared figure.
 *
 * Pass `declared: null` when nothing has been read off a bottle. There is
 * deliberately no third argument that lets a caller substitute the computed
 * value for a missing declared one.
 */
export function gateOne(computed: number, declared: number | null): GateOneVerdict {
  const c = toLabelPrecision(computed);
  if (declared === null) {
    return {
      status: "unverified",
      computed: c,
      declared: null,
      gap: null,
      reason:
        "No declared ABV recorded for this drink, so the label and the recipe " +
        "cannot be compared. Saved, but unverified — this is not agreement.",
    };
  }
  const d = toLabelPrecision(declared);
  const gap = toLabelPrecision(Math.abs(c - d));
  if (gap > GATE_1_TOLERANCE_POINTS) {
    return {
      status: "fail",
      computed: c,
      declared: d,
      gap,
      message:
        `This recipe computes to ${c.toFixed(1)}% ABV, but the label declares ` +
        `${d.toFixed(1)}%. That is a gap of ${gap.toFixed(1)} points, over the ` +
        `${GATE_1_TOLERANCE_POINTS.toFixed(1)}-point legal tolerance for spirit drinks. ` +
        `Saving is refused. Either the recipe is wrong or the label is — establish ` +
        `which before changing anything, and never edit one to match the other.`,
    };
  }
  return { status: "pass", computed: c, declared: d, gap };
}

export interface DeclaredAbv {
  declared: number;
  source: string | null;
  noted: string | null;
}

/**
 * The declared ABV for a (drink, client), read from that client's SKUs.
 *
 * Returns null when no SKU carries one — which is the honest answer for the
 * Fortnum's and Cripps bottles, whose labels nobody has read.
 *
 * Every size of a drink is filled from one batch of one liquid, so the sizes
 * are expected to agree. If they ever do not, that is a data fault and this
 * returns the STRICTEST reading — the one furthest from the computed figure is
 * chosen by the caller — rather than silently picking a row. Disagreeing
 * labels are surfaced through `conflicts`.
 */
export async function declaredAbvFor(
  drinkId: number,
  clientId: number,
): Promise<{ value: DeclaredAbv | null; conflicts: number[] }> {
  const rows = await db
    .select({
      declaredAbv: skus.declaredAbv,
      source: skus.declaredAbvSource,
      noted: skus.declaredAbvNoted,
    })
    .from(skus)
    .where(
      and(eq(skus.drinkId, drinkId), eq(skus.clientId, clientId), isNotNull(skus.declaredAbv)),
    );

  if (rows.length === 0) return { value: null, conflicts: [] };

  const distinct = [...new Set(rows.map((r) => Number(r.declaredAbv)))].sort((a, b) => a - b);
  const first = rows[0];
  return {
    value: { declared: Number(first.declaredAbv), source: first.source, noted: first.noted },
    conflicts: distinct.length > 1 ? distinct : [],
  };
}
