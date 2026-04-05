import Nav from "@/components/Nav";

export default function StrategyPage() {
  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Nav />

      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <p
          className="text-xs uppercase tracking-[0.3em] mb-3 font-medium"
          style={{ color: "#c9a227" }}
        >
          Direction &amp; Goals
        </p>
        <h1
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
          style={{ color: "#f0f0f0", letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          Strategy &amp; Targets
        </h1>
        <p className="text-base max-w-md mb-16" style={{ color: "#4a4a4a" }}>
          Where we are going and how we plan to get there. Pricing, growth,
          wholesale, and the 2027 rebrand.
        </p>

        <div className="text-sm" style={{ color: "#555" }}>
          Content coming soon.
        </div>
      </main>
    </div>
  );
}
