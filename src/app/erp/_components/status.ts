/**
 * Shared status-filter primitives (no "use client" — importable from both the
 * server list pages and the client StatusFilter control). Keeps one definition
 * of the three states + the default so a page and its filter never disagree.
 */

export type StatusValue = "active" | "inactive" | "all";

export const STATUS_OPTIONS: { value: StatusValue; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
];

/** Normalise a raw searchParam value to a StatusValue (default: active). */
export function parseStatus(raw: string | string[] | undefined): StatusValue {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "inactive" || v === "all" ? v : "active";
}
