import { useState, useEffect, useCallback } from "react";
import * as api from "./lib/client";
import { Badge } from "./components/ui";
import { Dashboard } from "./pages/Dashboard";
import { Targets } from "./pages/Targets";
import { Settings } from "./pages/Settings";
import { Activity } from "./pages/Activity";
import { Preview } from "./pages/Preview";

type Page = "dashboard" | "targets" | "preview" | "activity" | "settings";

const NAV: { key: Page; label: string; icon: string }[] = [
  { key: "dashboard", label: "Engage", icon: "E" },
  { key: "targets", label: "Targets", icon: "T" },
  { key: "preview", label: "Preview", icon: "P" },
  { key: "activity", label: "Activity", icon: "A" },
  { key: "settings", label: "Settings", icon: "S" },
];

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [currentPage, setCurrentPage] = useState<string | null>(null);
  const [previewActive, setPreviewActive] = useState(false);
  const [prevPage, setPrevPage] = useState<Page>("dashboard");

  useEffect(() => {
    api.getChromeStatus()
      .then((s) => setCurrentPage(s.currentPage ?? null))
      .catch(() => {});
  }, []);

  // Listen for preview activity — auto-switch to Preview when browser starts working
  useEffect(() => {
    const es = new EventSource("/api/preview/stream");

    es.addEventListener("action", () => {
      if (!previewActive) {
        setPreviewActive(true);
        // Remember current page, switch to preview
        setPage((curr) => {
          if (curr !== "preview") setPrevPage(curr);
          return "preview";
        });
      }
    });

    es.addEventListener("status", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.active !== undefined) setPreviewActive(data.active);
      } catch {}
    });

    es.addEventListener("done", () => {
      setPreviewActive(false);
      // Auto-switch back to previous page after done
      setTimeout(() => {
        setPage((curr) => curr === "preview" ? prevPage : curr);
      }, 2000); // 2s delay so user can see the final state
    });

    return () => es.close();
  }, [prevPage, previewActive]);

  const handleSetPage = useCallback((p: Page) => {
    setPrevPage(page);
    setPage(p);
  }, [page]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-surface/80 backdrop-blur-md border-b border-ring flex items-center justify-between px-4 md:pl-52">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold tracking-tight">Page Engager</span>
        </div>
        <div className="flex items-center gap-2">
          {previewActive && (
            <Badge variant="danger" className="animate-pulse">LIVE</Badge>
          )}
          {currentPage ? (
            <Badge variant="success">{currentPage}</Badge>
          ) : (
            <Badge variant="warning">Select page in Settings</Badge>
          )}
        </div>
      </header>

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex fixed inset-y-0 left-0 z-30 w-48 bg-surface border-r border-ring flex-col pt-12">
        <div className="flex-1 flex flex-col gap-0.5 pt-3 px-2">
          {NAV.map((item) => {
            const active = page === item.key;
            const isPreviewLive = item.key === "preview" && previewActive;
            return (
              <button
                key={item.key}
                onClick={() => handleSetPage(item.key)}
                className={`flex items-center gap-3 h-9 px-2.5 rounded-[var(--radius-md)] border-none text-left cursor-pointer text-sm transition-all duration-150 ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <span className={`shrink-0 w-5 h-5 flex items-center justify-center rounded-[var(--radius-sm)] text-[10px] font-bold ${
                  active ? "bg-primary text-primary-foreground" : isPreviewLive ? "bg-red-600 text-white animate-pulse" : "bg-surface-hover text-muted"
                }`}>{item.icon}</span>
                <span>{item.label}</span>
                {isPreviewLive && !active && (
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse ml-auto" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Tab */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden bg-surface/90 backdrop-blur-md border-t border-ring">
        {NAV.map((item) => {
          const active = page === item.key;
          const isPreviewLive = item.key === "preview" && previewActive;
          return (
            <button
              key={item.key}
              onClick={() => handleSetPage(item.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 border-none cursor-pointer transition-colors duration-150 ${
                active ? "text-primary" : "text-subtle"
              }`}
            >
              <span className={`relative w-5 h-5 flex items-center justify-center rounded-[var(--radius-sm)] text-[10px] font-bold ${
                active ? "bg-primary text-primary-foreground" : isPreviewLive ? "bg-red-600 text-white animate-pulse" : ""
              }`}>
                {item.icon}
                {isPreviewLive && !active && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                )}
              </span>
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main */}
      <main className="flex-1 pt-12 pb-20 md:pb-0 md:ml-48 min-h-screen">
        <div className="max-w-3xl mx-auto p-4 md:p-6 animate-fade-in">
          {page === "dashboard" && <Dashboard currentPage={currentPage} />}
          {page === "targets" && <Targets />}
          {page === "preview" && <Preview />}
          {page === "activity" && <Activity />}
          {page === "settings" && <Settings onPageChange={setCurrentPage} />}
        </div>
      </main>
    </div>
  );
}
