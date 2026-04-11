import Nav from "@/components/Nav";

export default function RecipesPage() {
  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p
            className="text-xs uppercase tracking-[0.6em] mb-3 font-medium"
            style={{ color: "#c9a227" }}
          >
            Myatt&apos;s Fields Cocktails
          </p>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "#f0f0f0", letterSpacing: "-0.02em" }}
          >
            Recipes
          </h1>
        </div>

        <div
          className="rounded-xl p-10 text-center"
          style={{ background: "#0f0f0f", border: "1px solid #1c1c1c" }}
        >
          <div className="w-8 h-px mx-auto mb-8" style={{ background: "#c9a227" }} />
          <p className="text-sm uppercase tracking-[0.15em] font-medium" style={{ color: "#333" }}>
            Coming soon
          </p>
        </div>
      </main>
    </div>
  );
}
