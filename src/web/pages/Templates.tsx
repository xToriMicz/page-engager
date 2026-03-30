import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Button, Card, Input, Select, Textarea } from "../components/ui";
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
      <h1 className="text-xl font-bold mb-5">Comment Templates</h1>

      <Card title="Add Template" className="mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              className="sm:w-52"
            />
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
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
            Add Template
          </Button>
        </div>
      </Card>

      <Card title={`Templates (${templates.length})`}>
        {templates.length === 0 ? (
          <p className="text-dark-400 text-sm">No templates yet</p>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              className="flex flex-col sm:flex-row sm:items-start justify-between p-3 border-b border-dark-600 gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm">{t.name}</span>
                  <span className="text-[11px] px-2 py-0.5 bg-gray-700 rounded">
                    {t.category}
                  </span>
                </div>
                <div className="text-[13px] text-dark-200 whitespace-pre-wrap break-words">
                  {t.content}
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleDelete(t.id)} className="shrink-0 self-start">
                Delete
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
