import { useState, useEffect } from "react";
import * as api from "../api";

export function Targets() {
  const [targets, setTargets] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const load = () => api.getTargets().then(setTargets);
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!name || !url) return;
    await api.addTarget({ name, url });
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
      <h1 style={{ marginBottom: "20px" }}>Target Pages</h1>

      <div style={{ ...cardStyle, marginBottom: "16px" }}>
        <h3 style={{ marginBottom: "12px" }}>Add Target</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Page name"
            style={{ ...inputStyle, width: "200px" }}
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://facebook.com/pagename"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={handleAdd} style={btnStyle}>
            Add
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginBottom: "12px" }}>Targets ({targets.length})</h3>
        {targets.length === 0 ? (
          <p style={{ color: "#666" }}>No targets yet</p>
        ) : (
          targets.map((t) => (
            <div
              key={t.id}
              style={{
                padding: "12px",
                borderBottom: "1px solid #333",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: "bold" }}>{t.name}</div>
                <div style={{ fontSize: "12px", color: "#888" }}>{t.url}</div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "12px",
                    color: t.active ? "#22c55e" : "#666",
                  }}
                >
                  {t.active ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => handleDelete(t.id)}
                  style={{ ...btnStyle, background: "#dc2626", padding: "4px 12px", fontSize: "12px" }}
                >
                  Delete
                </button>
              </div>
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
