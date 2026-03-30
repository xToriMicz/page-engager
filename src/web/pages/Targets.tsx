import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Card, CardTitle, Button, Input, Badge, useToast } from "../components/ui";
import type { Target } from "../types";

export function Targets() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const load = () => api.getTargets().then(setTargets);
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setAdding(true);
    try {
      await api.addTarget({ url });
      setUrl("");
      load();
      toast("Target added", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
    setAdding(false);
  };

  const handleDelete = async (id: number) => {
    await api.deleteTarget(id);
    load();
    toast("Target removed", "info");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Add target</CardTitle>
        <div className="flex gap-2 mt-3">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="https://facebook.com/pagename"
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!url.trim() || adding}>
            {adding ? "..." : "Add"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Targets ({targets.length})</CardTitle>
        {targets.length === 0 ? (
          <p className="text-sm text-subtle mt-3">No targets yet</p>
        ) : (
          <div className="mt-3 space-y-0">
            {targets.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 border-b border-ring last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{t.name}</div>
                  <div className="text-xs text-subtle truncate font-mono">{t.url}</div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Badge variant={t.active ? "success" : "default"}>
                    {t.active ? "Active" : "Off"}
                  </Badge>
                  <Button variant="danger" size="xs" onClick={() => handleDelete(t.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
