/**
 * Flash-message plumbing for the global toast (Slice 1.1).
 *
 * A server action signals "this worked / this failed" by redirecting to a URL
 * carrying two params; the client `ToastHost` in the ERP layout reads them,
 * shows the toast, then strips them from the URL. This survives the redirect
 * that most ERP mutations do, and needs no context/provider wiring per form.
 *
 * Pure string helpers only — safe to import from server actions and components.
 */

export const FLASH_PARAM = "flash";
export const FLASH_TYPE_PARAM = "flashType";

export type FlashType = "success" | "error";

/** Append flash params to a path, e.g. withFlash("/erp/suppliers", "Bimber updated"). */
export function withFlash(path: string, message: string, type: FlashType = "success"): string {
  const [base, existing] = path.split("?");
  const params = new URLSearchParams(existing);
  params.set(FLASH_PARAM, message);
  params.set(FLASH_TYPE_PARAM, type);
  return `${base}?${params.toString()}`;
}
