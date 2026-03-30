import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Button, Card, Input, Select, Textarea, Badge } from "../components/ui";
import type { Template } from "../types";

export function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");

  const load = () => api.getTemplates().then(setTemplates);
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!name || !content) return;
    await api.addTemplate({ name, content, category });
    setName("");
    setContent("");
    setCategory("general");
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    await api.deleteTemplate(id);
    load();
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-white mb-5">Comment Templates</h1>

      <Card title="Add Template" className="mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              className="sm:w-52"
            />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-40">
              <option value="general">General</option>
              <option value="greeting">Greeting</option>
              <option value="support">Support</option>
              <option value="promo">Promo</option>
            </Select>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Comment template text..."
            rows={3}
          />
          <Button onClick={handleAdd} className="self-start">
            Add
          </Button>
        </div>
      </Card>

      <Card title={`Templates (${templates.length})`}>
        {templates.length === 0 ? (
          <p className="text-sm text-text-muted">No templates yet</p>
        ) : (
          <div className="space-y-0">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-start justify-between p-3 border-b border-border gap-2 hover:bg-card-hover transition-colors duration-150"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-200">{t.name}</span>
                    <Badge>{t.category}</Badge>
                  </div>
                  <div className="text-xs text-text-secondary whitespace-pre-wrap break-words">
                    {t.content}
                  </div>
                </div>
                <Button variant="danger" onClick={() => handleDelete(t.id)} className="shrink-0 self-start">
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
