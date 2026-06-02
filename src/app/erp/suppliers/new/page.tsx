import Link from "next/link";
import { COLOR, FONT } from "@/lib/design";
import { Field, Textarea, buttonPrimary, buttonGhost } from "../../_components/forms";
import { createSupplier } from "../actions";

export default function NewSupplierPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 40px 96px" }}>
      <h1
        style={{
          fontFamily: FONT.serif,
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          marginBottom: 24,
        }}
      >
        New supplier
      </h1>

      <form action={createSupplier} style={{ display: "grid", gap: 16 }}>
        <Field label="Name" name="name" required autoFocus />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Contact email" name="contactEmail" type="email" />
          <Field label="Contact phone" name="contactPhone" type="tel" />
        </div>
        <Textarea label="Address" name="address" rows={2} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Payment terms" name="paymentTerms" placeholder="e.g. 30 days" />
          <Field label="Default currency" name="defaultCurrency" defaultValue="GBP" />
        </div>
        <Textarea label="Notes" name="notes" rows={3} />

        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button type="submit" style={buttonPrimary}>
            Create supplier
          </button>
          <Link href="/erp/suppliers" style={{ ...buttonGhost, textDecoration: "none", display: "inline-block" }}>
            Cancel
          </Link>
        </div>
      </form>

      <p style={{ marginTop: 28, fontSize: 12, color: COLOR.muted }}>
        Active by default. You can deactivate later from the supplier&apos;s page.
      </p>
    </main>
  );
}
