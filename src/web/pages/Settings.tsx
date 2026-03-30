import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Button, Card } from "../components/ui";
import { useToast } from "../components/ui/Toast";
import type { ChromeStatus, PageInfo } from "../types";

interface SettingsProps {
  onPageChange: (pageName: string) => void;
}

export function Settings({ onPageChange }: SettingsProps) {
  const [status, setStatus] = useState<ChromeStatus | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [checking, setChecking] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const { toast } = useToast();

  const checkStatus = async () => {
    setChecking(true);
    try {
      const [s, p] = await Promise.all([api.getChromeStatus(), api.getPages()]);
      setStatus(s);
      setPages(p);
    } catch {
      setStatus({ browser: "", connected: false });
      setPages([]);
    }
    setChecking(false);
  };

  useEffect(() => { checkStatus(); }, []);

  const handleSwitch = async (pageName: string) => {
    setSwitching(pageName);
    try {
      const result = await api.switchPage(pageName);
      onPageChange(result.currentPage);
      toast(`Switched to ${result.currentPage}`, "success");
      await checkStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Switch failed";
      toast(msg, "error");
    }
    setSwitching(null);
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-white mb-5">Settings</h1>

      {/* Active Page */}
      <Card title="Active Page" className="mb-4">
        {checking ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-card-hover rounded-md animate-pulse" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <p className="text-sm text-text-muted">No pages found. Connect Chrome first.</p>
        ) : (
          <div className="space-y-2">
            {pages.map((p) => (
              <div
                key={p.name}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors duration-150 ${
                  p.active
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-border hover:bg-card-hover"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${p.active ? "bg-green-500" : "bg-text-muted"}`} />
                  <span className={`text-sm ${p.active ? "text-green-400 font-medium" : "text-gray-300"}`}>
                    {p.name}
                  </span>
                </div>
                {p.active ? (
                  <span className="text-xs text-green-500">active</span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSwitch(p.name)}
                    disabled={switching !== null}
                  >
                    {switching === p.name ? "Switching..." : "Switch"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Connection */}
      <Card title="Connection">
        {checking ? (
          <div className="h-20 bg-card-hover rounded-md animate-pulse" />
        ) : status?.connected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Chrome:</span>
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-green-400">Connected</span>
            </div>
            {status.browser && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">Browser:</span>
                <span className="text-xs text-gray-400 font-mono">{status.browser}</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-red-400 font-medium">Not Connected</span>
            </div>
            <p className="text-xs text-text-secondary mb-3">
              Start Chrome with debug port to connect:
            </p>
            <code className="block p-3 bg-page rounded-md font-mono text-xs text-amber-500 break-all mb-3">
              /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
            </code>
          </div>
        )}
        <Button onClick={checkStatus} disabled={checking} className="mt-3">
          {checking ? "Checking..." : "Refresh Status"}
        </Button>
      </Card>
    </div>
  );
}
