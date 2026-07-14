/**
 * RETRACTED, 14 Jul 2026.
 *
 * This file used to export STATIC_ANNUAL_REVENUE (the DTC/wholesale split) and
 * STATIC_ALERTS. Both were hand-typed. Every figure in the revenue table was
 * round to the nearest £100, because a person estimated them, and nothing in the
 * code or the tool response said so.
 *
 * Section 7 of the Exec Board 02 pack read that table as source data, concluded
 * "DTC has fallen every year since 2020", and recommended defunding the channel.
 * It was wrong twice over: the row labelled 2025 was really the 2026 year to
 * date (real 2025 DTC was £10,876.86, UP 74% on 2024), and the 2020 "COVID peak"
 * of £14,200 was understated by a factor of three and a half (the real figure is
 * £49,206.22 across 1,266 orders).
 *
 * Revenue now lives in `src/lib/revenue.ts`, where every figure carries a source
 * and an as-of date, and anything that cannot be reconciled says so. The exports
 * are deliberately NOT repointed at the new data: a caller that keeps working
 * while its meaning changes underneath it is how this happened in the first
 * place. Anything still importing from here should fail to build.
 *
 * If you are here because a build broke: good. Import from "@/lib/revenue".
 */

export const STATIC_ANNUAL_REVENUE__RETRACTED_SEE_LIB_REVENUE = undefined;
export const STATIC_ALERTS__RETRACTED_SEE_LIB_REVENUE = undefined;
