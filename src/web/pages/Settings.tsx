import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Card, CardTitle, Button, Badge, Skeleton, useToast } from "../components/ui";

interface Props {
  onPageChange: (name: string | null) => void;
}

interface ManagedPage {
  name: string;
  url: string;
}

export function Settings({ onPageChange }: Props) {
  const [status, setStatus] = useState<{ browser: string; connected: boolean; currentPage: string | null } | null>(null);
  const [pages, setPages] = useState<ManagedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [headless, setHeadless] = useState(true);
  const [profiles, setProfiles] = useState<{ name: string; hasCookies: boolean }[]>([]);
  const [currentProfile, setCurrentProfile] = useState("");
  const { toast } = useToast();

  const loadStatus = () => api.getChromeStatus().then(setStatus).catch(() => setStatus(null));
  const loadPages = async () => {
    setLoading(true);
    try {
      const data = await api.getPages();
      setPages(data.pages || []);
    } catch { setPages([]); }
    setLoading(false);
  };

  const refreshPages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions/pages/refresh", { method: "POST" });
      const data = await res.json();
      setPages(data.pages || []);
      toast("Pages refreshed", "success");
    } catch { toast("Refresh failed", "error"); }
    setLoading(false);
  };

  useEffect(() => {
    loadStatus(); loadPages();
    api.getHeadless().then((r) => setHeadless(r.headless)).catch(() => {});
    api.getProfiles().then((r) => {
      setProfiles(r.profiles);
      setCurrentProfile(r.currentProfile);
    }).catch(() => {});
  }, []);

  const handleSwitch = async (pageName: string) => {
    setSwitching(pageName);
    try {
      const result = await api.switchPage(pageName);
      if (result.success) {
        onPageChange(pageName);
        toast(`Switched to ${pageName}`, "success");
        loadStatus();
      } else {
        toast(`Failed: ${result.error}`, "error");
      }
    } catch (e: any) {
      toast(e.message, "error");
    }
    setSwitching(null);
  };

  return (
    <div className="space-y-4">
      {/* Chrome Profile */}
      {profiles.length > 0 && (
        <Card>
          <CardTitle>Chrome Profile</CardTitle>
          <p className="text-xs text-subtle mt-1 mb-3">
            Select the Chrome profile that is logged into Facebook
          </p>
          <div className="space-y-1">
            {profiles.filter((p) => p.hasCookies).map((p) => {
              const isActive = p.name === currentProfile;
              return (
                <button
                  key={p.name}
                  onClick={async () => {
                    setCurrentProfile(p.name);
                    await api.setProfile(p.name);
                    toast(`Switched to ${p.name} — restart browser`, "success");
                    loadStatus();
                    loadPages();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] border cursor-pointer text-left text-sm transition-all ${
                    isActive
                      ? "bg-primary/10 border-primary text-primary font-medium"
                      : "bg-transparent border-ring text-muted hover:border-primary/50"
                  }`}
                >
                  <span>{p.name}</span>
                  {isActive && <Badge variant="success">Active</Badge>}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Pages */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Your pages</CardTitle>
          <Button variant="ghost" size="xs" onClick={refreshPages} disabled={loading}>
            {loading ? "..." : "Refresh"}
          </Button>
        </div>
        {loading ? (
          <div className="mt-3 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : pages.length === 0 ? (
          <p className="text-sm text-subtle mt-3">No pages found</p>
        ) : (
          <div className="mt-3 space-y-0">
            {pages.map((p) => {
              const isActive = status?.currentPage === p.name;
              return (
                <div key={p.name} className={`flex items-center justify-between py-3 border-b border-ring last:border-0 ${isActive ? "bg-success/5 -mx-4 px-4 rounded-[var(--radius-md)]" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-success" : "bg-subtle"}`} />
                      <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                    </div>
                    <div className="text-xs text-subtle ml-4 truncate font-mono">{p.url}</div>
                  </div>
                  {isActive ? (
                    <Badge variant="success" className="ml-3">Active</Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-3 shrink-0"
                      onClick={() => handleSwitch(p.name)}
                      disabled={switching !== null}
                    >
                      {switching === p.name ? "..." : "Switch"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Browser Mode */}
      <Card>
        <CardTitle>Browser Mode</CardTitle>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">
              {headless ? "Headless (Preview)" : "Visible Browser"}
            </div>
            <p className="text-xs text-subtle mt-0.5">
              {headless
                ? "Browser runs hidden — watch in Preview PiP"
                : "Browser window opens on screen — 60 FPS real view"}
            </p>
          </div>
          <button
            onClick={async () => {
              const next = !headless;
              setHeadless(next);
              const result = await api.setHeadless(next);
              toast(result.message, "success");
              loadStatus();
            }}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer border-none ${
              headless ? "bg-primary" : "bg-success"
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              headless ? "left-0.5" : "left-6"
            }`} />
          </button>
        </div>
      </Card>

      {/* Connection */}
      <Card>
        <CardTitle>Connection</CardTitle>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Browser</span>
            <span className="text-foreground">{status?.browser || "Not connected"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Status</span>
            <Badge variant={status?.connected ? "success" : "danger"}>
              {status?.connected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Active page</span>
            <span className="text-foreground">{status?.currentPage || "None"}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
