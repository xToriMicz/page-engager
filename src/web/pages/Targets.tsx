import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Card, CardTitle, Button, Input, Badge, Skeleton, useToast } from "../components/ui";
import type { Target } from "../types";

interface Engager {
  name: string;
  url: string;
  interactionCount: number;
}

export function Targets() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [engagers, setEngagers] = useState<Engager[]>([]);
  const [myPageUrl, setMyPageUrl] = useState("");
  const { toast } = useToast();

  const load = () => api.getTargets().then(setTargets);
  useEffect(() => { load(); }, []);

  // Load current page URL for discover
  useEffect(() => {
    api.getChromeStatus().then((s) => {
      if (s.currentPage) {
        api.getPages().then((data) => {
          const p = data.pages?.find((pg: any) => pg.name === s.currentPage);
          if (p) setMyPageUrl(p.url);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handleAdd = async (targetUrl?: string, name?: string, interactionCount?: number) => {
    const u = targetUrl || url.trim();
    if (!u) return;
    setAdding(true);
    try {
      await api.addTarget({ url: u, name, interactionCount, source: targetUrl ? "discover" : "manual" });
      if (!targetUrl) setUrl("");
      load();
      toast("Target added", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
    setAdding(false);
  };

  const handleDiscover = async () => {
    if (!myPageUrl) {
      toast("Select your page in Settings first", "error");
      return;
    }
    setDiscovering(true);
    setEngagers([]);
    try {
      const result = await api.discoverEngagers(myPageUrl);
      setEngagers(result.engagers);
      load(); // reload targets — discovered engagers are auto-saved
      toast(`Found ${result.total} engagers — ${result.added || 0} new, ${result.updated || 0} updated`, "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
    setDiscovering(false);
  };

  const handleDelete = async (id: number) => {
    await api.deleteTarget(id);
    load();
    toast("Removed", "info");
  };

  const handleDeleteAll = async () => {
    if (targets.length === 0) return;
    await api.deleteAllTargets();
    load();
    setEngagers([]);
    toast("All targets removed", "info");
  };

  const existingUrls = new Set(targets.map((t) => t.url));

  return (
    <div className="space-y-4">
      {/* Discover */}
      <Card>
        <CardTitle>Discover People</CardTitle>
        <p className="text-xs text-muted mt-1 mb-3">
          Scan your page's posts — find people who comment and react frequently
        </p>
        <Button onClick={handleDiscover} disabled={discovering || !myPageUrl}>
          {discovering ? "Scanning your page..." : "Discover Engagers"}
        </Button>
        {!myPageUrl && (
          <p className="text-xs text-warning mt-2">Select your page in Settings first</p>
        )}
      </Card>

      {/* Discovered engagers */}
      {discovering && (
        <Card>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      )}

      {engagers.length > 0 && (
        <Card>
          <CardTitle>Found {engagers.length} engagers</CardTitle>
          <div className="mt-3">
            {engagers.map((e, i) => {
              const alreadyAdded = existingUrls.has(e.url);
              return (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-ring last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{e.name}</div>
                    <div className="text-xs text-subtle font-mono truncate">{e.url}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Badge variant="primary">{e.interactionCount}x</Badge>
                    {alreadyAdded ? (
                      <Badge variant="success">Added</Badge>
                    ) : (
                      <Button size="xs" onClick={() => handleAdd(e.url, e.name, e.interactionCount)}>Add</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Manual add */}
      <Card>
        <CardTitle>Add manually</CardTitle>
        <div className="flex gap-2 mt-3">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="https://facebook.com/pagename"
            className="flex-1"
          />
          <Button onClick={() => handleAdd()} disabled={!url.trim() || adding}>
            {adding ? "..." : "Add"}
          </Button>
        </div>
      </Card>

      {/* Current targets */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Targets ({targets.length})</CardTitle>
          {targets.length > 0 && (
            <Button variant="danger" size="xs" onClick={handleDeleteAll}>
              Remove All
            </Button>
          )}
        </div>
        {targets.length === 0 ? (
          <p className="text-sm text-subtle mt-3">No targets — discover or add manually</p>
        ) : (
          <div className="mt-3">
            {targets.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-3 border-b border-ring last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{t.name}</span>
                    {t.interactionCount > 0 && (
                      <Badge variant="primary">{t.interactionCount}x</Badge>
                    )}
                    {t.source === "discover" && (
                      <Badge variant="success">Discovered</Badge>
                    )}
                  </div>
                  <div className="text-xs text-subtle truncate font-mono">{t.url}</div>
                  {t.lastSeen && (
                    <div className="text-[10px] text-subtle mt-0.5">
                      Last seen: {new Date(t.lastSeen).toLocaleDateString("th-TH")}
                    </div>
                  )}
                </div>
                <Button variant="danger" size="xs" onClick={() => handleDelete(t.id)} className="ml-3">
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
