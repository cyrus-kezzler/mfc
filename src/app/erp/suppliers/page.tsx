import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { buttonPrimary } from "../_components/forms";
import { StatusFilter } from "../_components/StatusFilter";
import { parseStatus } from "../_components/status";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusRaw } = await searchParams;
  const status = parseStatus(statusRaw);

  const allRows = await db.select().from(suppliers).orderBy(asc(suppliers.name));
  const activeCount = allRows.filter((r) => r.active).length;
  const rows =
    status === "all"
      ? allRows
      : allRows.filter((r) => (status === "active" ? r.active : !r.active));

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 40px 96px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: FONT.serif,
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              marginBottom: 6,
            }}
          >
            Suppliers
          </h1>
          <p style={{ fontSize: 13, color: COLOR.muted }}>
            {allRows.length} on file · {activeCount} active
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <StatusFilter />
          <Link href="/erp/suppliers/new" style={{ ...buttonPrimary, textDecoration: "none" }}>
            New supplier
          </Link>
        </div>
      </div>

      {allRows.length === 0 ? (
        <EmptyState />
      ) : rows.length === 0 ? (
        <FilteredEmptyState status={status} />
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            ...tabularNums,
          }}
        >
          <thead>
            <tr style={{ borderTop: `2px solid ${COLOR.ink}`, borderBottom: `1px solid ${COLOR.ruleBold}` }}>
              <Th>Name</Th>
              <Th>Contact</Th>
              <Th>Terms</Th>
              <Th align="right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                <Td>
                  <Link
                    href={`/erp/suppliers/${s.id}`}
                    style={{ color: COLOR.ink, textDecoration: "none", fontWeight: 500 }}
                  >
                    {s.name}
                  </Link>
                </Td>
                <Td muted>
                  {s.contactEmail || s.contactPhone || <span style={{ color: COLOR.mutedLight }}>—</span>}
                </Td>
                <Td muted>{s.paymentTerms ?? <span style={{ color: COLOR.mutedLight }}>—</span>}</Td>
                <Td align="right">
                  {s.active ? (
                    <span style={{ color: COLOR.positive, fontSize: 11, ...smallCaps }}>Active</span>
                  ) : (
                    <span style={{ color: COLOR.mutedLight, fontSize: 11, ...smallCaps }}>Inactive</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 12px",
        fontSize: 10,
        color: COLOR.muted,
        fontWeight: 500,
        ...smallCaps,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  muted,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  muted?: boolean;
}) {
  return (
    <td
      style={{
        padding: "12px",
        textAlign: align,
        color: muted ? COLOR.muted : COLOR.ink,
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: `1px dashed ${COLOR.rule}`,
        padding: "48px 24px",
        textAlign: "center",
        color: COLOR.muted,
      }}
    >
      <p style={{ fontFamily: FONT.serif, fontSize: 18, fontStyle: "italic", marginBottom: 16 }}>
        No suppliers yet.
      </p>
      <Link href="/erp/suppliers/new" style={{ ...buttonPrimary, textDecoration: "none" }}>
        Add the first one
      </Link>
    </div>
  );
}

function FilteredEmptyState({ status }: { status: "active" | "inactive" | "all" }) {
  return (
    <div
      style={{
        border: `1px dashed ${COLOR.rule}`,
        padding: "40px 24px",
        textAlign: "center",
        color: COLOR.muted,
      }}
    >
      <p style={{ fontFamily: FONT.serif, fontSize: 16, fontStyle: "italic" }}>
        No {status} suppliers.
      </p>
    </div>
  );
}
