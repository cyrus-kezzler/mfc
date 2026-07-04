"use client";

/**
 * Global save-confirmation toast (Slice 1.1, spec item #4).
 *
 * Foundational affordance: without it Clemency keeps asking "did that save?".
 * Mounted once in the ERP layout. Reads the flash params (see ./flash.ts) that
 * server actions attach to their post-mutation redirect, shows a toast, then
 * strips the params so a refresh doesn't re-fire it.
 *
 * Success: green, 3s auto-dismiss, dismissible by click.
 * Error:   red, sticky until dismissed.
 *
 * Every form built in Slices 2–7 inherits this by redirecting through withFlash().
 */

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { COLOR, FONT } from "@/lib/design";
import { FLASH_PARAM, FLASH_TYPE_PARAM, type FlashType } from "./flash";

type Toast = { message: string; type: FlashType; id: number };

function ToastHostInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<Toast | null>(null);

  const message = searchParams.get(FLASH_PARAM);
  const rawType = searchParams.get(FLASH_TYPE_PARAM);

  useEffect(() => {
    if (!message) return;
    const type: FlashType = rawType === "error" ? "error" : "success";
    setToast({ message, type, id: Date.now() });

    // Strip the flash params so a refresh / back-nav doesn't replay the toast.
    const next = new URLSearchParams(searchParams.toString());
    next.delete(FLASH_PARAM);
    next.delete(FLASH_TYPE_PARAM);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, rawType]);

  useEffect(() => {
    if (!toast || toast.type === "error") return; // errors are sticky
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  const isError = toast.type === "error";
  return (
    <div
      role="status"
      aria-live={isError ? "assertive" : "polite"}
      onClick={() => setToast(null)}
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        maxWidth: 480,
        padding: "12px 18px",
        cursor: "pointer",
        fontFamily: FONT.sans,
        fontSize: 13,
        lineHeight: 1.4,
        color: "#fff",
        background: isError ? COLOR.flag : COLOR.positive,
        boxShadow: "0 6px 20px rgba(26,24,21,0.22)",
        display: "flex",
        gap: 12,
        alignItems: "baseline",
      }}
    >
      <span>{toast.message}</span>
      <span aria-hidden style={{ marginLeft: "auto", opacity: 0.7, fontSize: 12 }}>
        {isError ? "dismiss ✕" : "✕"}
      </span>
    </div>
  );
}

export function ToastHost() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <ToastHostInner />
    </Suspense>
  );
}
