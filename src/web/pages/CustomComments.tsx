import { useState, useEffect, useRef } from "react";
import * as api from "../lib/client";
import { Card, CardTitle, Button, Badge, useToast } from "../components/ui";
import type { Template } from "../types";

export function CustomComments() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newComment, setNewComment] = useState("");
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = () => api.getTemplates().then(setTemplates);
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const lines = newComment.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return;
    setAdding(true);
    let added = 0;
    for (const line of lines) {
      try {
        await api.addTemplate({ name: line.slice(0, 30), content: line, category: "custom" });
        added++;
      } catch {}
    }
    setNewComment("");
    load();
    toast(`Added ${added} comment${added > 1 ? "s" : ""}`, "success");
    setAdding(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      toast("File is empty", "error");
      return;
    }
    setAdding(true);
    let added = 0;
    for (const line of lines) {
      try {
        await api.addTemplate({ name: line.slice(0, 30), content: line, category: "custom" });
        added++;
      } catch {}
    }
    load();
    toast(`Imported ${added} comments from ${file.name}`, "success");
    setAdding(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (id: number) => {
    await api.deleteTemplate(id);
    load();
  };

  const handleDeleteAll = async () => {
    for (const t of templates) {
      await api.deleteTemplate(t.id);
    }
    load();
    toast("All custom comments removed", "info");
  };

  return (
    <div className="space-y-4">
      {/* Add comments */}
      <Card>
        <CardTitle>Add Custom Comments</CardTitle>
        <p className="text-xs text-subtle mt-1 mb-3">
          1 line = 1 comment. These will be used randomly instead of AI-generated comments.
        </p>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={"สวัสดีครับ ชอบโพสต์มากเลย\nน่าสนใจมากครับ ติดตามอยู่นะ\nเห็นด้วยเลยครับ ดีมากๆ"}
          rows={5}
          className="w-full bg-background border border-ring rounded-[var(--radius-md)] px-3 py-2 text-sm text-foreground resize-y focus:outline-none focus:border-primary font-mono"
        />
        <div className="flex gap-2 mt-2">
          <Button onClick={handleAdd} disabled={!newComment.trim() || adding} className="flex-1">
            {adding ? "Adding..." : `Add ${newComment.split("\n").filter((l) => l.trim()).length || 0} Comments`}
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={adding}>
            Import .txt
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </Card>

      {/* Comment list */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Custom Comments ({templates.length})</CardTitle>
          {templates.length > 0 && (
            <Button variant="danger" size="xs" onClick={handleDeleteAll}>
              Remove All
            </Button>
          )}
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-subtle mt-3">No custom comments — add above or import from .txt</p>
        ) : (
          <div className="mt-3">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-ring last:border-0 gap-3">
                <p className="text-sm text-foreground flex-1">{t.content}</p>
                <Button variant="danger" size="xs" onClick={() => handleDelete(t.id)} className="shrink-0">
                  x
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* How it works */}
      <Card>
        <CardTitle>How it works</CardTitle>
        <div className="mt-2 text-xs text-subtle space-y-1">
          <p>1. Custom comments are picked randomly when engaging</p>
          <p>2. If no custom comments exist, AI generates one</p>
          <p>3. Works with both Auto Engage and Semi-Auto</p>
        </div>
      </Card>
    </div>
  );
}
