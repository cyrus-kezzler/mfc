import { notFound } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { COLOR, FONT, smallCaps } from "@/lib/design";
import { isErpEnabled } from "@/lib/flags";
import { ErpSubnav } from "./_components/Subnav";

export const metadata = {
  title: "Speed Rail — Back Bar ERP",
};

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  if (!isErpEnabled()) {
    notFound();
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
    </div>
  );
}
