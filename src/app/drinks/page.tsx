import Link from "next/link";
import Nav from "@/components/Nav";
import { COLOR, FONT, smallCaps } from "@/lib/design";
import { dbConfigured, listDrinks, type DrinkListRow } from "@/lib/drinks-db";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function DrinksPage() {
  const ready = dbConfigured();
  const rows: DrinkListRow[] = ready ? await listDrinks() : [];
  const active = rows.filter((r) => r.status === "active");
  const archived = rows.filter((r) => r.status === "archived");

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 96px" }}>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 16, ...smallCaps }}>
          Drinks · Recipes
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(36px, 6vw, 48px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            marginBottom: 12,
          }}
        >
          Drinks
        </h1>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 17,
            color: COLOR.inkSoft,
            lineHeight: 1.5,
            maxWidth: 560,
            fontWeight: 300,
            marginBottom: 36,
          }}
        >
          The source of truth for every cocktail and its client recipes. The
          calculator reads from here — edit a recipe and the next batch reflects it.
        </p>

        {!ready ? (
          <SetupNotice />
        ) : rows.length === 0 ? (
          <EmptyNotice />
        ) : (
          <>
            <DrinkTable rows={active} />
            {archived.length > 0 && (
              <details style={{ marginTop: 32 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 11,
                    color: COLOR.muted,
                    ...smallCaps,
                  }}
                >
                  Archived · {archived.length}
                </summary>
                <div style={{ marginTop: 12 }}>
                  <DrinkTable rows={archived} />
                </div>
              </details>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DrinkTable({ rows }: { rows: DrinkListRow[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ borderTop: `2px solid ${COLOR.ink}`, borderBottom: `1px solid ${COLOR.ruleBold}` }}>
          <th style={thStyle}>Drink</th>
          <th style={thStyle}>Recipes</th>
          <th style={{ ...thStyle, textAlign: "right" }}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.slug} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
            <td style={{ padding: "14px 12px" }}>
              <Link
                href={`/drinks/${d.slug}`}
                style={{
                  fontFamily: FONT.serif,
                  fontSize: 18,
                  fontWeight: 500,
                  color: d.status === "archived" ? COLOR.mutedLight : COLOR.ink,
                  textDecoration: "none",
                }}
              >
                {d.name}
              </Link>
            </td>
            <td style={{ padding: "14px 12px", color: COLOR.muted }}>
              {d.clientNames.length ? (
                d.clientNames.map((c) => SHORT[c] ?? c).join(" · ")
              ) : (
                <span style={{ color: COLOR.mutedLight }}>no recipe</span>
              )}
            </td>
            <td style={{ padding: "14px 12px", textAlign: "right", color: COLOR.muted }}>
              {fmtDate(d.updatedAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SHORT: Record<string, string> = {
  "Myatt's Fields": "MFC",
  "Fortnum & Mason": "F&M",
  Cripps: "Cripps",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 10,
  color: COLOR.muted,
  fontWeight: 500,
  ...smallCaps,
};

function SetupNotice() {
  return (
    <div style={{ border: `1px dashed ${COLOR.rule}`, padding: "40px 24px", color: COLOR.muted }}>
      <p style={{ fontFamily: FONT.serif, fontSize: 18, fontStyle: "italic", marginBottom: 8 }}>
        Drinks have moved to the database.
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        Set <code style={{ fontFamily: FONT.mono }}>DATABASE_URL</code> (Neon), then run{" "}
        <code style={{ fontFamily: FONT.mono }}>npm run db:migrate &amp;&amp; npm run db:seed</code>.
      </p>
    </div>
  );
}

function EmptyNotice() {
  return (
    <div style={{ border: `1px dashed ${COLOR.rule}`, padding: "40px 24px", color: COLOR.muted }}>
      <p style={{ fontFamily: FONT.serif, fontSize: 18, fontStyle: "italic" }}>
        No drinks yet. Run <code style={{ fontFamily: FONT.mono }}>npm run db:seed</code>.
      </p>
    </div>
  );
}
