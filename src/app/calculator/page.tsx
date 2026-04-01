import Nav from "@/components/Nav";
import Calculator from "@/components/Calculator";

export default function CalculatorPage() {
  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-16">
        <Calculator />
      </main>
    </div>
  );
}
