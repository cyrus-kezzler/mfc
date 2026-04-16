export function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtShort(n: number) {
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}k`;
  return fmt(n);
}

export function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function KpiCard({
  label,
  value,
  sub,
  accent,
  warning,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: accent ? "#0f0f0f" : "#0a0a0a",
        border: `1px solid ${warning ? "rgba(224,122,95,0.3)" : accent ? "rgba(201,162,39,0.2)" : "#1c1c1c"}`,
      }}
    >
      <p className="text-[9px] uppercase tracking-[0.12em] mb-2" style={{ color: "#555" }}>
        {label}
      </p>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color: accent ? "#c9a227" : "#f0f0f0" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-2" style={{ color: warning ? "#e07a5f" : "#444" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function Section({
  title,
  badge,
  right,
  children,
}: {
  title: string;
  badge: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isLive = badge === "Live";
  return (
    <div
      className="rounded-xl p-6 mb-8"
      style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "#555" }}>
          {title}
        </p>
        <span
          className="px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase"
          style={{
            background: isLive ? "rgba(79,174,143,0.1)" : "rgba(85,85,85,0.1)",
            color: isLive ? "#4fae8f" : "#555",
          }}
        >
          {badge}
        </span>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </div>
  );
}

export function PeriodPills<T extends string | number>({
  values,
  selected,
  onChange,
  format,
}: {
  values: T[];
  selected: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => {
        const isSelected = v === selected;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors"
            style={{
              background: isSelected ? "rgba(201,162,39,0.15)" : "#111",
              color: isSelected ? "#c9a227" : "#888",
              border: `1px solid ${isSelected ? "rgba(201,162,39,0.35)" : "#1c1c1c"}`,
              cursor: "pointer",
            }}
          >
            {format ? format(v) : String(v)}
          </button>
        );
      })}
    </div>
  );
}
