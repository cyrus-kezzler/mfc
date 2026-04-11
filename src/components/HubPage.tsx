import Nav from "@/components/Nav";
import Link from "next/link";

export type HubModule = {
  href: string;
  label: string;
  sublabel: string;
  description: string;
  status: "live" | "building" | "soon";
};

type Props = {
  eyebrow: string;
  title: string;
  intro: string;
  modules: HubModule[];
};

const STATUS_COPY: Record<HubModule["status"], string> = {
  live: "Open",
  building: "In progress",
  soon: "Coming soon",
};

export default function HubPage({ eyebrow, title, intro, modules }: Props) {
  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <div className="mb-16 sm:mb-20">
          <p
            className="text-xs uppercase tracking-[0.6em] mb-3 font-medium"
            style={{ color: "#c9a227" }}
          >
            {eyebrow}
          </p>
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ color: "#f0f0f0", letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            {title}
          </h1>
          <p className="text-base max-w-xl" style={{ color: "#4a4a4a" }}>
            {intro}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod) => (
            <ModuleCard key={mod.href} {...mod} />
          ))}
        </div>
      </main>
    </div>
  );
}

function ModuleCard({ href, label, sublabel, description, status }: HubModule) {
  const isLive = status === "live";
  const Wrapper = (isLive ? Link : "div") as React.ElementType;
  const statusColor = status === "live" ? "#c9a227" : status === "building" ? "#888" : "#333";

  return (
    <Wrapper
      {...(isLive ? { href } : {})}
      className={`group block rounded-xl p-8 transition-all duration-200 ${
        isLive ? "hover:bg-[#111] hover:border-[#2a2a2a] cursor-pointer" : "opacity-70"
      }`}
      style={{
        background: "#0f0f0f",
        border: "1px solid #1c1c1c",
      }}
    >
      <div className="w-8 h-px mb-8" style={{ background: "#c9a227" }} />
      <p
        className="text-xs uppercase tracking-[0.15em] mb-1 font-medium"
        style={{ color: "#c9a227" }}
      >
        {sublabel}
      </p>
      <h2
        className="text-xl font-bold mb-4"
        style={{ color: "#f0f0f0", letterSpacing: "-0.01em" }}
      >
        {label}
      </h2>
      <p className="text-sm leading-relaxed mb-8" style={{ color: "#444" }}>
        {description}
      </p>
      <div className="flex items-center gap-2">
        <span
          className="text-xs uppercase tracking-[0.12em] font-medium transition-colors duration-150"
          style={{ color: statusColor }}
        >
          {STATUS_COPY[status]}
        </span>
        {isLive && (
          <span
            className="text-sm transition-all duration-200 group-hover:translate-x-1"
            style={{ color: "#c9a227" }}
          >
            →
          </span>
        )}
      </div>
    </Wrapper>
  );
}
