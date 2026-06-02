/**
 * Speed Rail (Back Bar ERP) feature flags.
 *
 * Slice-by-slice rollout per spec §15. Single env var controls the whole module
 * for now; can split per-slice later (e.g. SPEED_RAIL_INBOUNDS=1) if we ever
 * need to ship a slice in isolation. When the flag is off, /erp/* 404s and the
 * "Speed Rail" nav link is hidden.
 *
 * Server-only — do not import from client components.
 */

const TRUTHY = new Set(["1", "true", "TRUE", "yes", "on"]);

export function isErpEnabled(): boolean {
  return TRUTHY.has(process.env.SPEED_RAIL_ENABLED ?? "");
}
