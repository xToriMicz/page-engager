import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Button, Card, Input } from "../components/ui";
import type { Target } from "../types";

export function Targets() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [resolving, setResolving] = useState(false);

  const load = () => api.getTargets().then(setTargets);
  useEffect(() => { load(); }, []);

  const handleUrlBlur = async () => {
    if (!url || name) return;
    if (!url.includes("facebook.com")) return;
    setResolving(true);
    try {
      const result = await api.resolveTarget(url);
      if (result.name) setName(result.name);
    } catch { /* ignore */ }
    setResolving(false);
  };

  const handleAdd = async () => {
    if (!url) return;
    await api.addTarget({ name: name || undefined, url });
    setName("");
    setUrl("");
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this target?")) return;
    await api.deleteTarget(id);
    load();
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-white mb-5">Target Pages</h1>

      <Card title="Add Target" className="mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={resolving ? "Fetching page name..." : "Page name (auto-fill)"}
            className="sm:w-60"
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://facebook.com/pagename"
            className="flex-1"
          />
          <Button onClick={handleAdd}>Add</Button>
        </div>
      </Card>

      <Card title={`Targets (${targets.length})`}>
        {targets.length === 0 ? (
          <p className="text-sm text-text-muted">No targets yet</p>
        ) : (
          <div className="space-y-0">
            {targets.map((t) => (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border-b border-border gap-2 hover:bg-card-hover transition-colors duration-150"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`w-2 h-2 rounded-full ${t.active ? "bg-green-500" : "bg-text-muted"}`} />
                    <span className="text-sm font-medium text-gray-200">{t.name}</span>
                  </div>
                  <div className="text-xs text-text-secondary font-mono truncate pl-4">{t.url}</div>
                </div>
                <Button variant="danger" onClick={() => handleDelete(t.id)}>
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
