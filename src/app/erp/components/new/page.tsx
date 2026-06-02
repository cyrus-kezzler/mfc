import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { FONT } from "@/lib/design";
import { ComponentFormBody } from "../_form";
import { createComponent } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewComponentPage() {
  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.active, true))
    .orderBy(asc(suppliers.name));

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
        New component
      </h1>
      <form action={createComponent}>
        <ComponentFormBody suppliers={supplierRows} />
      </form>
    </main>
  );
}
