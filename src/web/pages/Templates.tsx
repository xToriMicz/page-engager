import { useState, useEffect } from "react";
import * as api from "../api";

export function Templates() {
  const [templates, setTemplates] = useState<any[]>([]);
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
      <h1 style={{ marginBottom: "20px" }}>Comment Templates</h1>

      <div style={{ ...cardStyle, marginBottom: "16px" }}>
        <h3 style={{ marginBottom: "12px" }}>Add Template</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              style={{ ...inputStyle, width: "200px" }}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={inputStyle}
            >
              <option value="general">General</option>
              <option value="greeting">Greeting</option>
              <option value="support">Support</option>
              <option value="promo">Promo</option>
            </select>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Comment template text..."
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <button onClick={handleAdd} style={{ ...btnStyle, alignSelf: "flex-start" }}>
            Add Template
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginBottom: "12px" }}>Templates ({templates.length})</h3>
        {templates.length === 0 ? (
          <p style={{ color: "#666" }}>No templates yet</p>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              style={{
                padding: "12px",
                borderBottom: "1px solid #333",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontWeight: "bold" }}>{t.name}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 6px",
                      background: "#374151",
                      borderRadius: "4px",
                    }}
                  >
                    {t.category}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "#aaa", whiteSpace: "pre-wrap" }}>
                  {t.content}
                </div>
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                style={{ ...btnStyle, background: "#dc2626", padding: "4px 12px", fontSize: "12px" }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: "8px",
  padding: "16px",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#2a2a2a",
  border: "1px solid #444",
  borderRadius: "6px",
  color: "#e0e0e0",
  fontSize: "14px",
};

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#2563eb",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  cursor: "pointer",
  fontSize: "14px",
};
