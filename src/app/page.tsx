import Nav from "@/components/Nav";
import Link from "next/link";
import Image from "next/image";

const MODULES = [
  {
    href: "/strategy",
    label: "Strategy",
    sublabel: "Direction & Goals",
    description:
      "Where we are going and how we plan to get there. Pricing, growth, wholesale, and the 2027 rebrand.",
  },
  {
    href: "/finances",
    label: "Finances",
    sublabel: "Money in, money out",
    description:
      "Revenue, wholesale invoices, channel profitability, audit, and live Shopify and QuickBooks data.",
  },
  {
    href: "/production",
    label: "Production",
    sublabel: "Kitchen & fulfilment",
    description:
      "Batching, recipe ratios, inventory, and stock audits — the operational side of making cocktails.",
  },
  {
    href: "/sales",
    label: "Sales",
    sublabel: "Customers & pipeline",
    description:
      "Wholesale accounts, caterers, Amazon, and the CRM we are about to build.",
  },
  {
    href: "/drinks",
    label: "Drinks",
    sublabel: "Range & content",
    description:
      "Recipes, the cocktail master list, photo assets, content plan, and new product development.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Nav />

      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        {/* Hero */}
        <div className="mb-16 sm:mb-20">
          <div className="flex items-center gap-4 mb-8">
            <Image
              src="/MFC Logo - Standard.png"
              alt="Myatt's Fields Cocktails"
              width={48}
              height={48}
              className="object-contain opacity-90"
            />
            <div
              className="h-px flex-1"
              style={{ background: "linear-gradient(to right, #1e1e1e, transparent)" }}
            />
          </div>

          <p
            className="text-xs uppercase tracking-[0.6em] mb-3 font-medium"
            style={{ color: "#c9a227" }}
          >
            Myatt&apos;s Fields
          </p>
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ color: "#f0f0f0", letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            The Back Bar
          </h1>
          <p className="text-base max-w-md" style={{ color: "#4a4a4a" }}>
            The operational and strategic hub for Myatt&apos;s Fields Cocktails.
          </p>
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((mod) => (
            <ModuleCard key={mod.href} {...mod} />
          ))}
        </div>
      </main>
    </div>
  );
}

function ModuleCard({
  href,
  label,
  sublabel,
  description,
}: {
  href: string;
  label: string;
  sublabel: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl p-8 transition-all duration-200 hover:bg-[#111] hover:border-[#2a2a2a]"
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
          className="text-xs uppercase tracking-[0.12em] font-medium transition-colors duration-150 group-hover:text-[#c9a227]"
          style={{ color: "#333" }}
        >
          Open
        </span>
        <span
          className="text-sm transition-all duration-200 group-hover:translate-x-1 group-hover:text-[#c9a227]"
          style={{ color: "#333" }}
        >
          →
        </span>
      </div>
    </Link>
  );
}
