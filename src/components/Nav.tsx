"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export type NavSection = {
  label: string;
  href: string;
  /** Paths (startsWith) that should highlight this section as active. */
  match: string[];
};

/**
 * Top-level sections. Add new entries here to extend the nav.
 * The `match` array lets one nav button own multiple URL prefixes
 * (e.g. "Finances" lights up for both /finances and legacy /dashboard).
 */
export const NAV_SECTIONS: NavSection[] = [
  { label: "Strategy", href: "/strategy", match: ["/strategy"] },
  { label: "Finances", href: "/finances", match: ["/finances", "/dashboard"] },
  { label: "Production", href: "/production", match: ["/production", "/calculator"] },
  { label: "Sales", href: "/sales", match: ["/sales"] },
  { label: "Drinks", href: "/drinks", match: ["/drinks", "/recipes"] },
];

export default function Nav() {
  const path = usePathname();

  return (
    <nav
      className="no-print sticky top-0 z-50"
      style={{
        background: "rgba(8, 8, 8, 0.92)",
        borderBottom: "1px solid #1c1c1c",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <Image
            src="/MFC Logo - Standard.png"
            alt="MFC"
            width={28}
            height={28}
            className="object-contain opacity-90 group-hover:opacity-100 transition-opacity"
          />
          <span
            className="font-bold text-xs uppercase hidden sm:inline"
            style={{ color: "#f0f0f0", letterSpacing: "0.36em" }}
          >
            The Back Bar
          </span>
        </Link>

        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {NAV_SECTIONS.map((s) => {
            const active = s.match.some((m) => path === m || path.startsWith(m + "/") || path === m);
            return (
              <NavLink key={s.href} href={s.href} active={active}>
                {s.label}
              </NavLink>
            );
          })}
        </div>

        <NavLink href="/settings" active={path === "/settings"}>
          Settings
        </NavLink>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded text-xs font-medium uppercase transition-all duration-150 whitespace-nowrap"
      style={{
        background: active ? "#1a1a1a" : "transparent",
        color: active ? "#c9a227" : "#555",
        letterSpacing: "0.18em",
      }}
    >
      {children}
    </Link>
  );
}
