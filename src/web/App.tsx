import { useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Targets } from "./pages/Targets";
import { Templates } from "./pages/Templates";
import { Sessions } from "./pages/Sessions";

type Page = "dashboard" | "targets" | "templates" | "sessions";

const pages: { key: Page; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "targets", label: "Target Pages" },
  { key: "templates", label: "Templates" },
  { key: "sessions", label: "Sessions" },
];

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-dark-900 text-dark-100">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-dark-800 border-b border-dark-600 px-4 py-3 md:hidden">
        <h2 className="text-lg font-semibold">Page Engager</h2>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-dark-100 bg-transparent border-none text-2xl cursor-pointer"
        >
          {menuOpen ? "\u2715" : "\u2630"}
        </button>
      </div>

      {/* Sidebar */}
      <nav
        className={`fixed inset-y-0 left-0 z-30 w-56 bg-dark-800 border-r border-dark-600 flex flex-col transition-transform duration-200 md:translate-x-0 md:static ${menuOpen ? "translate-x-0" : "-translate-x-full"} pt-14 md:pt-0`}
      >
        <h2 className="hidden md:block px-5 py-5 text-lg font-semibold border-b border-dark-600">
          Page Engager
        </h2>
        {pages.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              setPage(p.key);
              setMenuOpen(false);
            }}
            className={`px-5 py-3 border-none text-left cursor-pointer text-sm transition-colors ${
              page === p.key
                ? "bg-blue-600 text-white"
                : "bg-transparent text-dark-100 hover:bg-dark-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {/* Overlay for mobile menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 pt-16 md:pt-6">
        {page === "dashboard" && <Dashboard />}
        {page === "targets" && <Targets />}
        {page === "templates" && <Templates />}
        {page === "sessions" && <Sessions />}
      </main>
    </div>
  );
}
