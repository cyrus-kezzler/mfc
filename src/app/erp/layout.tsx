import Link from "next/link";
import Nav from "@/components/Nav";
import { COLOR, FONT, smallCaps } from "@/lib/design";
import { isErpEnabled } from "@/lib/flags";
import { ModuleDisabled } from "@/components/ModuleDisabled";
import { ErpSubnav } from "./_components/Subnav";
import { ToastHost } from "./_components/Toast";

export const metadata = {
  title: "Speed Rail — Back Bar ERP",
};

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  // Flag off: stay inside the Back Bar shell (nav intact) and show an intentional
  // "disabled" state, rather than throwing notFound() which drops the user onto
  // the bare Next 404 outside the shell. See Slice 1.1 fix #5.
  if (!isErpEnabled()) {
    return (
      <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
        <Nav />
        <ModuleDisabled
          eyebrow="Speed Rail"
          title="The ERP module is currently disabled"
          message="Speed Rail — the Back Bar operations spine — is switched off in this environment. It’s intentionally off, not broken. An owner can enable it by setting the SPEED_RAIL_ENABLED flag; until then, the rest of Back Bar is unaffected."
          backHref="/"
          backLabel="Back to Back Bar home"
        />
      </div>
    );
  }

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <header
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "32px 40px 0",
        }}
      >
        <p style={{ fontSize: 10, color: COLOR.accent, marginBottom: 12, ...smallCaps }}>
          Speed Rail — operations spine
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            rowGap: 8,
            borderBottom: `1px solid ${COLOR.rule}`,
            paddingBottom: 18,
            marginBottom: 24,
          }}
        >
          <Link
            href="/erp"
            style={{
              fontFamily: FONT.serif,
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: COLOR.ink,
              textDecoration: "none",
            }}
          >
            ERP
          </Link>
          <ErpSubnav />
        </div>
      </header>
      {children}
      <ToastHost />
    </div>
  );
}
