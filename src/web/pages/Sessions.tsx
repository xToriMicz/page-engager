import { useState, useEffect } from "react";
import * as api from "../api";

export function Sessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionName, setSessionName] = useState("");
  const [loginOpened, setLoginOpened] = useState(false);

  const load = () => api.getSessions().then(setSessions);
  useEffect(() => { load(); }, []);

  const handleOpenLogin = async () => {
    try {
      const result = await api.openLogin();
      setLoginOpened(true);
      alert(result.message);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCapture = async () => {
    if (!sessionName) return;
    try {
      await api.captureSession(sessionName);
      setSessionName("");
      setLoginOpened(false);
      load();
      alert("Session captured!");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this session?")) return;
    await api.deleteSession(id);
    load();
  };

  const handleCloseBrowser = async () => {
    await api.closeBrowser();
    setLoginOpened(false);
    alert("Browser closed");
  };

  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>Sessions</h1>

      <div style={{ ...cardStyle, marginBottom: "16px" }}>
        <h3 style={{ marginBottom: "12px" }}>Login to Facebook</h3>
        <p style={{ fontSize: "13px", color: "#888", marginBottom: "12px" }}>
          Step 1: Open browser and login manually. Step 2: Name and capture the session.
        </p>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={handleOpenLogin} style={btnStyle}>
            1. Open Login Page
          </button>
          {loginOpened && (
            <>
              <input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Session name (e.g. My Page)"
                style={{ ...inputStyle, width: "250px" }}
              />
              <button
                onClick={handleCapture}
                disabled={!sessionName}
                style={{ ...btnStyle, background: "#16a34a" }}
              >
                2. Capture Session
              </button>
            </>
          )}
          <button
            onClick={handleCloseBrowser}
            style={{ ...btnStyle, background: "#6b7280" }}
          >
            Close Browser
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginBottom: "12px" }}>Saved Sessions ({sessions.length})</h3>
        {sessions.length === 0 ? (
          <p style={{ color: "#666" }}>No sessions. Login to create one.</p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              style={{
                padding: "12px",
                borderBottom: "1px solid #333",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ fontWeight: "bold" }}>{s.name}</span>
                <span style={{ fontSize: "12px", color: "#888", marginLeft: "12px" }}>
                  {s.createdAt}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "12px",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: s.active ? "#16a34a" : "#374151",
                  }}
                >
                  {s.active ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => handleDelete(s.id)}
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
