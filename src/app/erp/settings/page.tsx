import { db } from "@/db";
import { systemSettings, SETTING_KEYS } from "@/db/schema";
import { COLOR, FONT, smallCaps } from "@/lib/design";
import { Field, buttonPrimary } from "../_components/forms";
import { updateSettings } from "./actions";

export const dynamic = "force-dynamic";

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.WASTAGE_PCT]: "0.02",
  [SETTING_KEYS.LABOUR_RATE_GBP_PER_HOUR]: "15.00",
  [SETTING_KEYS.NEXT_SERIAL_NUMBER]: "35001",
};

export default async function SettingsPage() {
  const rows = await db.select().from(systemSettings);
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
  const updatedByKey = Object.fromEntries(rows.map((r) => [r.key, r.updatedAt])) as Record<
    string,
    Date
  >;

  const wastagePctDecimal = settings[SETTING_KEYS.WASTAGE_PCT] ?? DEFAULTS[SETTING_KEYS.WASTAGE_PCT];
  const wastagePctHuman = (Number(wastagePctDecimal) * 100).toString();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 40px 96px" }}>
      <h1
        style={{
          fontFamily: FONT.serif,
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          marginBottom: 6,
        }}
      >
        Settings
      </h1>
      <p style={{ fontSize: 13, color: COLOR.muted, marginBottom: 28 }}>
        Three numbers that drive cost rollup and serial issuance for the whole system.
      </p>

      <form action={updateSettings} style={{ display: "grid", gap: 18 }}>
        <FieldWithMeta
          label="Global wastage %"
          help="Applied to every recipe rollup. 2% by default."
          updatedAt={updatedByKey[SETTING_KEYS.WASTAGE_PCT]}
        >
          <Field label="" name="wastagePct" type="number" step="0.01" min="0" defaultValue={wastagePctHuman} required />
        </FieldWithMeta>

        <FieldWithMeta
          label="Labour rate (£ / hour)"
          help="Folds into product cost via production-run minutes."
          updatedAt={updatedByKey[SETTING_KEYS.LABOUR_RATE_GBP_PER_HOUR]}
        >
          <Field
            label=""
            name="labourRate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={settings[SETTING_KEYS.LABOUR_RATE_GBP_PER_HOUR] ?? DEFAULTS[SETTING_KEYS.LABOUR_RATE_GBP_PER_HOUR]}
            required
          />
        </FieldWithMeta>

        <FieldWithMeta
          label="Next bottle serial number"
          help="Five-digit suffix, global counter. Picks up from where the spreadsheet left off."
          updatedAt={updatedByKey[SETTING_KEYS.NEXT_SERIAL_NUMBER]}
        >
          <Field
            label=""
            name="nextSerial"
            type="number"
            step="1"
            min="1"
            defaultValue={settings[SETTING_KEYS.NEXT_SERIAL_NUMBER] ?? DEFAULTS[SETTING_KEYS.NEXT_SERIAL_NUMBER]}
            required
          />
        </FieldWithMeta>

        <button type="submit" style={{ ...buttonPrimary, justifySelf: "start", marginTop: 8 }}>
          Save settings
        </button>
      </form>

      <hr style={{ margin: "40px 0 20px", border: "none", borderTop: `1px solid ${COLOR.rule}` }} />

      <p style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.6 }}>
        Roles (Owner = Cyrus, Operator = Clemency) wire in at slice 6 when the price-list builder
        lands. Until then the existing single-password auth covers all ERP operations.
      </p>
    </main>
  );
}

function FieldWithMeta({
  label,
  help,
  children,
  updatedAt,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
  updatedAt?: Date;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: COLOR.ink }}>{label}</span>
        {updatedAt && (
          <span style={{ fontSize: 10, color: COLOR.mutedLight, ...smallCaps }}>
            updated {updatedAt.toISOString().slice(0, 10)}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: COLOR.muted, marginBottom: 8 }}>{help}</p>
      {children}
    </div>
  );
}
