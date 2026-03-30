import { useState, useEffect } from "react";
import * as api from "./lib/client";
import { Dashboard } from "./pages/Dashboard";
import { Targets } from "./pages/Targets";
import { Templates } from "./pages/Templates";
import { Settings } from "./pages/Settings";

type Page = "dashboard" | "targets" | "templates" | "settings";

const pages: { key: Page; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "\u2302" },
  { key: "targets", label: "Targets", icon: "\u25CE" },
  { key: "templates", label: "Templates", icon: "\u2630" },
  { key: "settings", label: "Settings", icon: "\u2699" },
];

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [currentPage, setCurrentPage] = useState<string | null>(null);

  useEffect(() => {
    api.getChromeStatus()
      .then((s) => setCurrentPage(s.currentPage ?? null))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-page text-text-primary">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-card border-b border-border flex items-center justify-between px-4 md:pl-20">
        <span className="text-lg font-semibold text-white">Page Engager</span>
        <div className="flex items-center gap-2">
          {currentPage ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-gray-300">{currentPage}</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm text-amber-400">No page selected</span>
            </>
          )}
        </div>
      </header>

      {/* Desktop Sidebar — 64px icon-only, expand on hover */}
      <nav className="hidden md:flex fixed inset-y-0 left-0 z-30 w-16 hover:w-50 bg-card border-r border-border flex-col pt-14 transition-all duration-200 overflow-hidden group">
        {pages.map((p) => (
          <button
            key={p.key}
            onClick={() => setPage(p.key)}
            className={`flex items-center gap-3 px-5 py-4 border-none text-left cursor-pointer text-sm transition-colors duration-150 whitespace-nowrap ${
              page === p.key
                ? "border-l-2 border-l-blue-500 text-blue-400 bg-blue-500/5"
                : "border-l-2 border-l-transparent text-text-secondary hover:bg-card-hover hover:text-text-primary"
            }`}
          >
            <span className="text-lg shrink-0 w-6 text-center">{p.icon}</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">{p.label}</span>
          </button>
        ))}
      </nav>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden bg-card border-t border-border">
        {pages.map((p) => (
          <button
            key={p.key}
            onClick={() => setPage(p.key)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 border-none cursor-pointer text-xs transition-colors duration-150 ${
              page === p.key
                ? "text-blue-400"
                : "text-text-muted"
            }`}
          >
            <span className="text-lg">{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 pt-14 pb-20 md:pb-0 md:ml-16 p-4 md:p-6">
        {page === "dashboard" && <Dashboard currentPage={currentPage} />}
        {page === "targets" && <Targets />}
        {page === "templates" && <Templates />}
        {page === "settings" && <Settings onPageChange={setCurrentPage} />}
      </main>
    </div>
  );
}
