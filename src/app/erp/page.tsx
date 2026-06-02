import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { components, suppliers, systemSettings, SETTING_KEYS } from "@/db/schema";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export const dynamic = "force-dynamic";

async function loadCounts() {
  const [supplierCount] = await db.select({ n: sql<number>`count(*)::int` }).from(suppliers);
  const [componentCount] = await db.select({ n: sql<number>`count(*)::int` }).from(components);
  const settings = await db.select().from(systemSettings);
  return {
    suppliers: supplierCount?.n ?? 0,
    components: componentCount?.n ?? 0,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) as Record<string, string>,
  };
}

export default async function ErpHome() {
  const data = await loadCounts();

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "16px 40px 96px",
      }}
    >
      <p
        style={{
          fontFamily: FONT.serif,
          fontStyle: "italic",
          fontSize: 18,
          color: COLOR.inkSoft,
          maxWidth: 640,
          marginBottom: 36,
          lineHeight: 1.5,
        }}
      >
        One source of truth for what we make, what we make it from, what it costs, and what we
        have. The spine, in slices.
      </p>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 11, color: COLOR.muted, marginBottom: 16, ...smallCaps }}>
          Slice 1 — Foundations
        </h2>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            borderTop: `1px solid ${COLOR.rule}`,
          }}
        >
          <ModuleRow
            href="/erp/suppliers"
            title="Suppliers"
            gloss="Where everything we buy comes from."
            count={`${data.suppliers}`}
          />
          <ModuleRow
            href="/erp/components"
            title="Components"
            gloss="Every ingredient, sub-recipe, dry good, and packaging item — with current latest cost."
            count={`${data.components}`}
          />
          <ModuleRow
            href="/erp/settings"
            title="Settings"
            gloss={`Wastage ${pctOrDash(data.settings[SETTING_KEYS.WASTAGE_PCT])} · Labour £${data.settings[SETTING_KEYS.LABOUR_RATE_GBP_PER_HOUR] ?? "—"}/hr · Next serial ${data.settings[SETTING_KEYS.NEXT_SERIAL_NUMBER] ?? "—"}`}
            count="3"
          />
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 11, color: COLOR.muted, marginBottom: 16, ...smallCaps }}>
          Coming next
        </h2>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            borderTop: `1px solid ${COLOR.rule}`,
          }}
        >
          <Pending title="Inbounds" gloss="Receive a delivery → updates cost + stock." />
          <Pending title="Recipes (BOM)" gloss="Bill of materials per finished product." />
          <Pending title="Cost rollup" gloss="Latest-cost unit cost for any product." />
          <Pending title="Production runs + serials" gloss="Run, consume, output batch, issue serials, print labels." />
          <Pending title="Price lists (Owner only)" gloss="Manual per-channel price list builder + PDF." />
          <Pending title="Dashboard" gloss="Five numbers, with % revenue by channel as the headline." />
        </ul>
      </section>
    </main>
  );
}

function pctOrDash(raw: string | undefined): string {
  if (!raw) return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function ModuleRow({
  href,
  title,
  gloss,
  count,
}: {
  href: string;
  title: string;
  gloss: string;
  count: string;
}) {
  return (
    <li style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
      <Link
        href={href}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 28,
          alignItems: "baseline",
          padding: "20px 0",
          textDecoration: "none",
          color: COLOR.ink,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: FONT.serif,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              marginBottom: 4,
            }}
          >
            {title}
          </h3>
          <p style={{ fontSize: 14, color: COLOR.muted, lineHeight: 1.45 }}>{gloss}</p>
        </div>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            color: COLOR.muted,
            paddingTop: 6,
          }}
        >
          {count}
        </span>
      </Link>
    </li>
  );
}

function Pending({ title, gloss }: { title: string; gloss: string }) {
  return (
    <li
      style={{
        borderBottom: `1px solid ${COLOR.rule}`,
        padding: "16px 0",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 28,
        alignItems: "baseline",
        color: COLOR.mutedLight,
      }}
    >
      <div>
        <h3
          style={{
            fontFamily: FONT.serif,
            fontSize: 17,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            marginBottom: 4,
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 13, lineHeight: 1.45 }}>{gloss}</p>
      </div>
      <span style={{ fontSize: 11, ...smallCaps }}>Planned</span>
    </li>
  );
}
