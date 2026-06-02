"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLOR, FONT, smallCaps } from "@/lib/design";

const SECTIONS: { label: string; href: string }[] = [
  { label: "Suppliers", href: "/erp/suppliers" },
  { label: "Components", href: "/erp/components" },
  { label: "Settings", href: "/erp/settings" },
];

export function ErpSubnav() {
  const path = usePathname();
  return (
    <nav style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
      {SECTIONS.map((s) => {
        const active = path === s.href || path.startsWith(s.href + "/");
        return (
          <Link
            key={s.href}
            href={s.href}
            style={{
              fontFamily: FONT.sans,
              fontSize: 12,
              color: active ? COLOR.accent : COLOR.inkSoft,
              fontWeight: active ? 500 : 400,
              textDecoration: "none",
              borderBottom: active ? `1px solid ${COLOR.accent}` : "1px solid transparent",
              paddingBottom: 4,
              ...smallCaps,
            }}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
