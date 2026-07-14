# Revenue provenance

**Rule: Back Bar may not serve a number that does not trace to a source system.**

This is not a style preference. It is the response to a specific failure, and the mechanism is more important than the numbers it fixed.

## What happened

Back Bar served an array called `annualDtcWholesaleSplit` from `src/lib/static-data.ts`. It gave DTC as 14200, 9600, 8200, 6800, 4100, 2800 for 2020 to 2025.

Every figure was round to the nearest £100, because a person typed them. Real revenue is never round. Nothing in the code, the tool response or the UI said the numbers were estimates, so the estimate sat in the data layer wearing the costume of data.

Section 7 of the Exec Board 02 pack read it as source, concluded "DTC has fallen every year since 2020", and recommended defunding the channel.

It was wrong twice.

- The row labelled **2025** was really the **2026 year to date**. A partial year was read as a full one and a death spiral was drawn through it. Real 2025 DTC was **£10,876.86, up 74% on 2024**.
- The row labelled **2020**, the "COVID DTC peak" of £14,200, was understated by a **factor of three and a half**. DTC actually took **£49,206.22** that year, across 1,266 orders.

The channel the pack proposed to defund is the only one in the business that has ever demonstrated it can scale.

## The fix is structural, not numerical

Correcting six figures would have reset the trap for the next person. So instead:

**1. Every figure carries a `source` and an `asOf`.** `shopify`, `quickbooks`, `amazon` or `manual`. There is currently nothing marked `manual`, and that is the point. Anything marked `manual` renders a visible warning in both the UI and the MCP response.

**2. The old array was removed, not repointed.** `get_revenue_overview` no longer returns `annualDtcWholesaleSplit`, and `static-data.ts` no longer exports `STATIC_ANNUAL_REVENUE`. A caller still reaching for either fails to build. A caller that keeps working while its meaning changes underneath it is how this happened in the first place.

**3. Derived figures are derived at read time.** `channel-revenue.json` holds the DTC series (from Shopify, which is the only source for it) and the *rules* for mapping QuickBooks accounts to channels. It deliberately holds no derived QuickBooks totals, so those cannot go stale relative to the snapshot they claim to come from. `src/lib/revenue.ts` is the only place a revenue figure may be produced.

**4. Sources declare their age.** The UI and the MCP both report how old each snapshot is and flag anything past 45 days. The old snapshot was three months stale and said nothing.

**5. Partial years are labelled as partial.** This is what actually caused the damage. A year that is still running is marked `partialYear: true` everywhere it appears, and the UI refuses to compute a year-on-year change against it.

**6. What cannot be known says so.** The channels do not sum to the P&L total. That variance is reported as a first-class fact with its explanation attached, rather than being smoothed away.

## What each channel actually is

| Channel | Source | Basis | Read this before quoting it |
|---|---|---|---|
| **DTC** | Shopify | `total_sales` | The only honest DTC in the business. Never take DTC from QuickBooks: its "Shopify" accounts under-report by £3,116.67 in 2025. |
| **Wholesale** | QuickBooks | **floor** | A floor, not a total. Real wholesale is this plus an unknown share of the unclassified bucket. |
| **Amazon** | QuickBooks | **gross**, plus net of Amazon's own fees | The headline is gross, and gross is close to meaningless here: Amazon's fees took **45.5% of gross in 2025** and **57.2% in 2024**. Read `netOfAmazonFees`. It still does not deduct the cost of the liquid, glass and packaging, so it is contribution before cost of goods, not profit. |
| **Unclassified** | QuickBooks | unknown | `Sales of Product Income`, £92,401 in 2025. Larger than every classified channel combined. Nobody knows what channel it is. |

## What is settled, and what is not

**Settled 14 Jul 2026.**

- **2025 total revenue is £143,513.32**, per the QuickBooks P&L. The rival figure of £46,800 came from the fabricated table's own invented total column. It was never a competing source, only the same guess wearing a different hat. Nothing should cite £46,800 again.
- **The unclassified account is not double-counting.** This was the leading hypothesis and it is wrong. The 2025 QuickBooks income accounts sum to exactly £143,513.32, the stated total, to the penny; P&L accounts are mutually exclusive by construction, so an account cannot hold revenue another account also holds. The £92k is real, additional, untagged revenue, almost certainly wholesale.
- **The £3,207.67 variance is fully explained**: £3,116.67 is Shopify's DTC figure exceeding QuickBooks' copy of it, and £91.00 is discounts, which belong to no channel.

**Amazon, corrected 14 Jul 2026.** The build brief said no net figure existed anywhere and that the Seller Central export was the only way to get one. That was wrong: QuickBooks has carried Amazon's cost accounts since 2024 (`Amazon FBA Fees`, `Amazon Advertising`, `Amazon Promotions`, `Amazon Seller Fees and Charges`, `Amazon Shipping Fees`). Back Bar now serves `netOfAmazonFees` from them.

| Year | Gross | Amazon's fees | Fee load | Net of fees |
|---|---|---|---|---|
| 2024 | £9,862.19 | £5,638.63 | 57.2% | £4,223.56 |
| 2025 | £11,780.77 | £5,361.00 | 45.5% | £6,419.77 |

For 2022, 2023 and 2026 the cost accounts do not exist in QuickBooks at all, so `netOfAmazonFees` returns **null, not zero**. A missing cost is not a free channel.

This does not settle whether Amazon makes money, and Back Bar does not claim it does. Product COGS is not allocated to the channel, so £6,419.77 is contribution *before* the cost of the liquid, the glass and the packaging. At the range's typical gross margin that is somewhere around break-even, which is consistent with the "loss-making" claim in Canon without proving it. What it does establish is the shape: **Amazon takes roughly half of every pound before we have paid for anything.**

**Still open.**

1. **What channel is the £92k?** The only thing standing between us and a real channel table. It is a bookkeeping job, not a forensic one. Owner: John at Fathom.
2. **Why is QuickBooks £3,116.67 short on DTC?** Which orders are missing, and is the leak in prior years too?
3. **Does Amazon actually make money?** Needs product COGS allocated to the channel, which needs the Seller Central export at SKU level. Cyrus's to pull. The fee load is now known; the bottom line is not.

## Refreshing

```
npx tsx scripts/revenue/refresh-dtc.ts           # dry run, prints the diff
npx tsx scripts/revenue/refresh-dtc.ts --write   # writes only if the basis holds
```

The script re-derives DTC from the Shopify Admin API and **refuses to overwrite if a closed year has moved**. A closed year should not change. If it has, either the script computes on a different basis than the committed series, or historical orders were edited. Either way a human decides, because silently overwriting a number whose meaning has changed underneath it is the original sin this file exists to end.

QuickBooks: refresh `qb-revenue.json` via `scripts/qb/pull-history.ts`. The channel figures follow automatically. Nothing is hand-copied.

## The rule this produces

> A strategy paper may not cite a number that does not trace to a source system. Back Bar may be the source, but only for tables that are actually derived. A hand-typed estimate in a data layer is more dangerous than no number at all, because it wears the costume of data.
