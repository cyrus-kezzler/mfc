"use client";

/**
 * Reusable Active / Inactive / All segmented filter for any ERP list.
 *
 * URL-driven: the selected option lives in a query param (default `status`), so
 * the list stays a server component that just reads searchParams and filters its
 * query. Ships on Suppliers in Slice 1.1; drops onto Components, Inbounds,
 * Customers, Recipes in later slices with no redesign — pass a different `param`
 * if a page needs more than one filter.
 *
 * Pair with the `StatusValue` type + `parseStatus` helper below so pages share
 * one definition of the three states and the default.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { COLOR, FONT, smallCaps } from "@/lib/design";
import { STATUS_OPTIONS as OPTIONS, parseStatus } from "./status";

export function StatusFilter({ param = "status" }: { param?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = parseStatus(searchParams.get(param) ?? undefined);

  return (
    <div
      role="group"
      aria-label="Filter by status"
      style={{
        display: "inline-flex",
        border: `1px solid ${COLOR.rule}`,
        overflow: "hidden",
      }}
    >
      {OPTIONS.map((o, i) => {
        const active = o.value === current;
        const next = new URLSearchParams(searchParams.toString());
        // "active" is the default — drop the param to keep the URL clean.
        if (o.value === "active") next.delete(param);
        else next.set(param, o.value);
        const qs = next.toString();
        return (
          <Link
            key={o.value}
            href={qs ? `${pathname}?${qs}` : pathname}
            aria-current={active ? "true" : undefined}
            style={{
              padding: "7px 14px",
              fontFamily: FONT.sans,
              fontSize: 11,
              textDecoration: "none",
              color: active ? COLOR.paper : COLOR.inkSoft,
              background: active ? COLOR.ink : "transparent",
              borderLeft: i === 0 ? "none" : `1px solid ${COLOR.rule}`,
              ...smallCaps,
            }}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
