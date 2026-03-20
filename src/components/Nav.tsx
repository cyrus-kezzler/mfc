"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const path = usePathname();

  return (
    <nav
      className="no-print sticky top-0 z-50 border-b"
      style={{ background: "#0d0d0d", borderColor: "#2d2d2d" }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
            style={{ background: "#c9a227", color: "#0a0a0a" }}
          >
            M
          </div>
          <span className="font-bold text-base tracking-tight" style={{ color: "#f0f0f0" }}>
            MFC Batch Calculator
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <NavLink href="/" active={path === "/"}>
            Calculator
          </NavLink>
          <NavLink href="/settings" active={path === "/settings"}>
            Settings
          </NavLink>
        </div>
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
      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
      style={{
        background: active ? "#1a3d29" : "transparent",
        color: active ? "#52b788" : "#9ca3af",
      }}
    >
      {children}
    </Link>
  );
}
