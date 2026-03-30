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
      <h1 className="text-xl font-bold mb-5">Target Pages</h1>

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
          <p className="text-dark-400 text-sm">No targets yet</p>
        ) : (
          targets.map((t) => (
            <div
              key={t.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border-b border-dark-600 gap-2"
            >
              <div className="min-w-0">
                <div className="font-bold text-sm">{t.name}</div>
                <div className="text-xs text-dark-300 truncate">{t.url}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs ${t.active ? "text-green-500" : "text-dark-400"}`}>
                  {t.active ? "Active" : "Inactive"}
                </span>
                <Button variant="danger" size="sm" onClick={() => handleDelete(t.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
