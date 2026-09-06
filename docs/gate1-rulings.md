# Gate 1 rulings — 5–6 September 2026

Cyrus's rulings on the twelve current recipes whose computed ABV sits more than
0.3 points from their declared label figure. Recorded here because they are
business decisions, and a decision that lives only in a tool is a decision
waiting to be lost.

**None of these have been applied.** See §3 — the ABV audit has to land first.

## 1. The rulings

| Drink | Gap | Ruling | Cyrus's note |
|---|---|---|---|
| Naked & Famous | 6.4 | Label wrong | — |
| Corpse Reviver | 5.8 | Label wrong | — |
| Gibson Martini | 4.7 | Label wrong | — |
| Baby Otis | 3.9 | Label wrong | "We've never added water to this drink — the client is encouraged to pour over ice" |
| Sakura Martini | 3.2 | Label wrong | — |
| Vesper Martini | 2.8 | Label wrong | — |
| Lychee Martini | 1.9 | Label wrong | — |
| Red Hook | 1.7 | Label wrong | — |
| Espresso Martini | 1.3 | Label wrong | "We changed vodka, and that hasn't been reflected in the label ABV — I'm not comfortable with sub-20% on this, so will need a discussion at a future board meeting" |
| Tuxedo | 1.2 | **Recipe wrong** | "First bug — this vermouth is 18% ABV and Hayman's is bottled at 41.2%. I'm afraid we need to do a complete audit of all Back Bar ABVs" |
| Margarita | 1.0 | Dilution missing | — |
| Trident | 0.5 | Dilution missing | — |

Nine "label wrong", two "dilution missing", one "recipe wrong".

## 2. What the notes settle

**Baby Otis kills the dilution hypothesis.** The strongest arithmetic case in the
whole set was Baby Otis: add 13.7% water and the computed figure lands on the
label figure almost exactly. Cyrus's answer is that no water is ever added — the
drink is poured over ice by the customer. So the coincidence was a coincidence,
and a tidy-looking piece of arithmetic was about to be mistaken for evidence.
Worth remembering the next time a number lands suspiciously well.

**Espresso Martini is a business decision, not a data one.** The vodka changed
and the label never followed. Cyrus is not comfortable declaring sub-20% on this
product, which makes the fix a board conversation about the recipe rather than a
correction to either figure. Flagged, not actioned.

## 3. Why none of this has been applied

Nine of the twelve rulings say "the label is wrong". Each of those was reached by
comparing a label against a **computed** figure — and every computed figure is
built from `components.abv`.

The Tuxedo note is the reason to stop. It is not one wrong number; it is evidence
that the component ABVs have never been checked. The audit that followed found:

- **46 of 52 alcoholic components carry a round number.** Ten different products
  are recorded at exactly 40.00%; five at 17.00%; five at 16.50%. Only six values
  in the whole set look like they were read off a bottle — 41.2, 41.4, 40.1,
  44.7, 20.3 and 1.7 — and one of those six is the one Cyrus says is wrong.
- **Eleven components name a category rather than a product** — "Rye", "Mezcal",
  "Calvados", "Triple Sec", "Tequila Reposado", "Manzanilla" and others. These
  cannot be verified against a bottle, because the record does not say which
  bottle.
- **`components.abv` has no source and no date.** See §4.
- **Six of the twelve ruled drinks depend on a flagged component.**

Correcting a label to match a computed figure that is itself wrong would print a
wrong number on a bottle. That is a worse outcome than the disagreement we
started with, and it is exactly the class of mistake `declared_abv` was created
to prevent — so the rulings wait.

## 4. The structural finding

`skus.declared_abv` carries `declared_abv_source` and `declared_abv_noted`,
with a long comment on the column explaining why: a figure without provenance is
a figure waiting to be silently overwritten, as seventeen of them were on
14 August 2026.

`components.abv` is a bare `numeric(5,2)`. No source. No date. Nothing recording
whether a value was read off a bottle, copied from a supplier sheet, or assumed
from the category.

So Gate 1 compares a **sourced** figure against an **unsourced** one. The
foundation is weaker than the thing standing on it, and the same lesson applies
one level down. The fix — `abv_source` and `abv_noted` on `components`, and a
verification pass that fills them — is the work of week 2.

## 5. Open question

Cyrus's note says "Hayman's is bottled at 41.2%". The database holds two gins
that could be meant:

- `Gin (in-house)` at **41.2%** — used in 11 current recipes
- `Old Tom Gin` at **41.4%** — used only in Tuxedo

Hayman's London Dry is 41.2% and Hayman's Old Tom is 41.4%, so both recorded
values may be right for their respective products. Either the Tuxedo recipe
points at the wrong component, or the Old Tom figure is wrong. **Needs Cyrus.**

Note that this correction alone does not close Tuxedo: swapping 41.4 for 41.2
moves the computed figure from 30.3 to 30.2 against a label of 29.1. Something
else in that recipe is also out.

---

*Rulings collected 5–6 September 2026 via the Gate 1 decision sheet. Recorded
here 6 September 2026. Nothing applied to the database.*
