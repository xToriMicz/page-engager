import { useState, useEffect } from "react";
import * as api from "../lib/client";
import { Card, CardTitle, Button, Input, Select, Textarea, Badge, useToast } from "../components/ui";
import type { Template } from "../types";

export function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const { toast } = useToast();

  const load = () => api.getTemplates().then(setTemplates);
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!name || !content) return;
    await api.addTemplate({ name, content, category });
    setName("");
    setContent("");
    load();
    toast("Template added", "success");
  };

  const handleDelete = async (id: number) => {
    await api.deleteTemplate(id);
    load();
    toast("Template removed", "info");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Add template</CardTitle>
        <div className="space-y-3 mt-3">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className="flex-1" />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-32">
              <option value="general">General</option>
              <option value="greeting">Greeting</option>
              <option value="support">Support</option>
              <option value="promo">Promo</option>
            </Select>
          </div>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Comment text..." rows={2} />
          <Button onClick={handleAdd} disabled={!name || !content} className="w-full sm:w-auto">Add Template</Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Templates ({templates.length})</CardTitle>
        {templates.length === 0 ? (
          <p className="text-sm text-subtle mt-3">No templates yet</p>
        ) : (
          <div className="mt-3 space-y-0">
            {templates.map((t) => (
              <div key={t.id} className="flex items-start justify-between py-3 border-b border-ring last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">{t.name}</span>
                    <Badge>{t.category}</Badge>
                  </div>
                  <p className="text-sm text-muted whitespace-pre-wrap">{t.content}</p>
                </div>
                <Button variant="danger" size="xs" className="ml-3 shrink-0" onClick={() => handleDelete(t.id)}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
