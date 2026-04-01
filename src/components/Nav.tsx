"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Nav() {
  const path = usePathname();
  const isHome = path === "/";

  return (
    <nav
      className="no-print sticky top-0 z-50"
      style={{
        background: "rgba(8, 8, 8, 0.92)",
        borderBottom: "1px solid #1c1c1c",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/MFC Logo - Standard.png"
            alt="MFC"
            width={28}
            height={28}
            className="object-contain opacity-90 group-hover:opacity-100 transition-opacity"
          />
          <span
            className="font-bold tracking-[0.18em] text-xs uppercase"
            style={{ color: "#f0f0f0", letterSpacing: "0.18em" }}
          >
            Myatt&apos;s Fields
          </span>
        </Link>

        {!isHome && (
          <div className="flex items-center gap-1">
            <NavLink href="/dashboard" active={path.startsWith("/dashboard")}>
              Dashboard
            </NavLink>
            <NavLink href="/calculator" active={path.startsWith("/calculator")}>
              Calculator
            </NavLink>
            <NavLink href="/recipes" active={path.startsWith("/recipes")}>
              Recipes
            </NavLink>
            <NavLink href="/settings" active={path === "/settings"}>
              Settings
            </NavLink>
          </div>
        )}

        {isHome && (
          <NavLink href="/settings" active={false}>
            Settings
          </NavLink>
        )}
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
      className="px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider transition-all duration-150"
      style={{
        background: active ? "#1a1a1a" : "transparent",
        color: active ? "#c9a227" : "#555",
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </Link>
  );
}
