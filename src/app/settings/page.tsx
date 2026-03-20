import Nav from "@/components/Nav";
import SettingsPanel from "@/components/SettingsPanel";

export default function SettingsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-16">
        <SettingsPanel />
      </main>
    </div>
  );
}
