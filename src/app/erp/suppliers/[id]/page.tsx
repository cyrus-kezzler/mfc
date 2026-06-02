import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { COLOR, FONT, smallCaps } from "@/lib/design";
import { Field, Textarea, buttonPrimary, buttonGhost } from "../../_components/forms";
import { updateSupplier, setSupplierActive } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number.parseInt(idStr, 10);
  if (!Number.isFinite(id)) notFound();

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!supplier) notFound();

  const updateAction = updateSupplier.bind(null, id);
  const toggleActive = async () => {
    "use server";
    await setSupplierActive(id, !supplier.active);
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 40px 96px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
        >
          {supplier.name}
        </h1>
        <span
          style={{
            fontSize: 11,
            color: supplier.active ? COLOR.positive : COLOR.mutedLight,
            ...smallCaps,
          }}
        >
          {supplier.active ? "Active" : "Inactive"}
        </span>
      </div>

      <form action={updateAction} style={{ display: "grid", gap: 16 }}>
        <Field label="Name" name="name" defaultValue={supplier.name} required autoFocus />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Contact email" name="contactEmail" type="email" defaultValue={supplier.contactEmail} />
          <Field label="Contact phone" name="contactPhone" type="tel" defaultValue={supplier.contactPhone} />
        </div>
        <Textarea label="Address" name="address" rows={2} defaultValue={supplier.address} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Payment terms" name="paymentTerms" defaultValue={supplier.paymentTerms} />
          <Field label="Default currency" name="defaultCurrency" defaultValue={supplier.defaultCurrency} />
        </div>
        <Textarea label="Notes" name="notes" rows={3} defaultValue={supplier.notes} />

        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button type="submit" style={buttonPrimary}>
            Save changes
          </button>
          <Link href="/erp/suppliers" style={{ ...buttonGhost, textDecoration: "none", display: "inline-block" }}>
            Cancel
          </Link>
        </div>
      </form>

      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: `1px solid ${COLOR.rule}` }} />

      <form action={toggleActive}>
        <button
          type="submit"
          style={{
            ...buttonGhost,
            color: supplier.active ? COLOR.flag : COLOR.positive,
            borderColor: supplier.active ? COLOR.flagSoft : COLOR.positive,
          }}
        >
          {supplier.active ? "Deactivate supplier" : "Reactivate supplier"}
        </button>
        <p style={{ marginTop: 10, fontSize: 12, color: COLOR.muted }}>
          Deactivating hides the supplier from new inbounds. Existing inbounds and price history are
          preserved.
        </p>
      </form>

      <p style={{ marginTop: 32, fontSize: 11, color: COLOR.mutedLight, ...smallCaps }}>
        Created {supplier.createdAt.toISOString().slice(0, 10)} · Updated{" "}
        {supplier.updatedAt.toISOString().slice(0, 10)}
      </p>
    </main>
  );
}
