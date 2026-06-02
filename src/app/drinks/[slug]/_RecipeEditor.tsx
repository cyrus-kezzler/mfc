"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { inputStyle, labelStyle, buttonPrimary, buttonGhost } from "../../erp/_components/forms";
import type { SaveState } from "./actions";

type ComponentOption = { id: number; name: string };
type LineState = { componentId: string; percentage: string };

export function RecipeEditor({
  action,
  components,
  initialLines,
  heading,
  submitLabel,
  cancelHref,
}: {
  action: (prev: SaveState, form: FormData) => Promise<SaveState>;
  components: ComponentOption[];
  initialLines: { componentId: number; percentage: number }[];
  heading: string;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [lines, setLines] = useState<LineState[]>(
    initialLines.length
      ? initialLines.map((l) => ({ componentId: String(l.componentId), percentage: String(l.percentage) }))
      : [{ componentId: "", percentage: "" }],
  );

  const serialized = useMemo(
    () =>
      JSON.stringify(
        lines
          .filter((l) => l.componentId !== "")
          .map((l) => ({ componentId: Number(l.componentId), percentage: Number(l.percentage) })),
      ),
    [lines],
  );

  const total = useMemo(
    () => Math.round(lines.reduce((a, l) => a + (Number(l.percentage) || 0), 0) * 10) / 10,
    [lines],
  );
  const chosen = lines.map((l) => l.componentId).filter((c) => c !== "");
  const hasDuplicate = new Set(chosen).size !== chosen.length;
  const canSave = total === 100 && !hasDuplicate && chosen.length > 0;

  function update(i: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { componentId: "", percentage: "" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="lines" value={serialized} />

      <h2 style={{ fontFamily: FONT.serif, fontSize: 22, fontWeight: 500, marginBottom: 20 }}>{heading}</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <span style={{ ...labelStyle, flex: 1, marginBottom: 0 }}>Ingredient</span>
          <span style={{ ...labelStyle, width: 110, marginBottom: 0 }}>Percentage</span>
          <span style={{ width: 34 }} />
        </div>

        {lines.map((line, i) => {
          const dup = line.componentId !== "" && chosen.filter((c) => c === line.componentId).length > 1;
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                value={line.componentId}
                onChange={(e) => update(i, { componentId: e.target.value })}
                style={{ ...inputStyle, flex: 1, borderColor: dup ? COLOR.flag : COLOR.rule }}
              >
                <option value="">— choose —</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                max="100"
                value={line.percentage}
                onChange={(e) => update(i, { percentage: e.target.value })}
                style={{ ...inputStyle, width: 110, ...tabularNums }}
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                aria-label="Remove line"
                style={{
                  width: 34,
                  height: 38,
                  border: `1px solid ${COLOR.rule}`,
                  background: "transparent",
                  color: COLOR.muted,
                  cursor: lines.length === 1 ? "not-allowed" : "pointer",
                  opacity: lines.length === 1 ? 0.4 : 1,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={addLine} style={{ ...buttonGhost, marginTop: 12 }}>
        + Add ingredient
      </button>

      {/* Live total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: 20,
          paddingTop: 14,
          borderTop: `2px solid ${COLOR.ink}`,
        }}
      >
        <span style={{ fontSize: 11, color: COLOR.muted, ...smallCaps }}>Total</span>
        <span style={{ fontSize: 18, fontWeight: 500, color: total === 100 ? COLOR.ink : COLOR.flag, ...tabularNums }}>
          {total.toFixed(1)}%
        </span>
      </div>

      {(hasDuplicate || (total !== 100 && chosen.length > 0)) && (
        <p style={{ marginTop: 8, fontSize: 13, color: COLOR.flag, fontFamily: FONT.serif, fontStyle: "italic" }}>
          {hasDuplicate ? "Each ingredient can appear only once." : "Lines must sum to exactly 100%."}
        </p>
      )}
      {state?.error && (
        <p style={{ marginTop: 8, fontSize: 13, color: COLOR.flag, fontFamily: FONT.serif, fontStyle: "italic" }}>
          {state.error}
        </p>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button type="submit" disabled={!canSave || isPending} style={{ ...buttonPrimary, opacity: !canSave || isPending ? 0.5 : 1, cursor: !canSave || isPending ? "not-allowed" : "pointer" }}>
          {isPending ? "Saving…" : submitLabel}
        </button>
        <Link href={cancelHref} style={{ ...buttonGhost, textDecoration: "none" }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
