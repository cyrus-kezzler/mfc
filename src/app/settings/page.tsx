import Nav from "@/components/Nav";
import SettingsPanel, { type SettingsIngredient } from "@/components/SettingsPanel";
import { listIngredients } from "@/lib/erp/ingredients";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const rows = await listIngredients();

  // Map the database register onto the shape the batch-settings panel wants:
  // sub-recipes are house-made, everything else defaults to a bottle of its
  // pack size. Local overrides in the browser refine from there.
  const ingredients: SettingsIngredient[] = rows.map((r) => ({
    name: r.name,
    type: r.isSubRecipe ? ("house-made" as const) : ("bottle" as const),
    bottleSize: r.packSize && r.packSize > 1 ? r.packSize : 700,
  }));

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main
        className="settings-main"
        style={{ maxWidth: 820, margin: "0 auto", padding: "48px 40px 96px" }}
      >
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          Settings
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(40px, 5vw, 48px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            marginBottom: 18,
            color: COLOR.ink,
          }}
        >
          Settings
        </h1>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 17,
            color: COLOR.inkSoft,
            lineHeight: 1.55,
            maxWidth: 560,
            fontWeight: 300,
            marginBottom: 32,
          }}
        >
          Override default bottle sizes and ingredient types per client. Defaults come
          from the database register; overrides are stored locally in this browser.
        </p>
        <SettingsPanel ingredients={ingredients} />
      </main>
      <style>{`
        @media (max-width: 640px) {
          .settings-main { padding: 32px 18px 64px !important; }
        }
      `}</style>
    </div>
  );
}
