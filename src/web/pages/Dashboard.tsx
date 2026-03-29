import { useState, useEffect } from "react";
import * as api from "../api";

export function Dashboard() {
  const [targets, setTargets] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    api.getTargets().then(setTargets);
    api.getComments().then(setComments);
    api.getSessions().then(setSessions);
    api.getTemplates().then(setTemplates);
  }, []);

  const handleScan = async () => {
    if (!selectedTarget) return;
    setScanning(true);
    try {
      const result = await api.scanPosts(selectedTarget);
      setPosts(result.posts);
    } catch (e: any) {
      alert(e.message);
    }
    setScanning(false);
  };

  const handleSend = async (post: any) => {
    if (!commentText.trim() || !selectedTarget) return;
    setSending(true);
    try {
      const result = await api.sendComment({
        targetId: selectedTarget,
        postUrl: post.url,
        postText: post.text,
        commentText,
      });
      if (result.status === "sent") {
        alert("Comment sent!");
        setCommentText("");
        api.getComments().then(setComments);
      } else {
        alert(`Failed: ${result.error}`);
      }
    } catch (e: any) {
      alert(e.message);
    }
    setSending(false);
  };

  const activeSession = sessions.find((s) => s.active);

  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>Dashboard</h1>

      {/* Status */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        <StatusCard label="Targets" value={targets.length} />
        <StatusCard label="Templates" value={templates.length} />
        <StatusCard label="Comments Sent" value={comments.filter((c) => c.status === "sent").length} />
        <StatusCard
          label="Session"
          value={activeSession ? activeSession.name : "None"}
          color={activeSession ? "#22c55e" : "#ef4444"}
        />
      </div>

      {/* Scan & Comment */}
      <div style={cardStyle}>
        <h3 style={{ marginBottom: "12px" }}>Scan & Comment</h3>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <select
            value={selectedTarget ?? ""}
            onChange={(e) => setSelectedTarget(Number(e.target.value) || null)}
            style={inputStyle}
          >
            <option value="">-- Select Target --</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button onClick={handleScan} disabled={!selectedTarget || scanning} style={btnStyle}>
            {scanning ? "Scanning..." : "Scan Posts"}
          </button>
        </div>

        {posts.length > 0 && (
          <div>
            <h4 style={{ marginBottom: "8px" }}>Posts Found ({posts.length})</h4>
            {posts.map((post, i) => (
              <div key={i} style={{ ...cardStyle, marginBottom: "12px" }}>
                <p style={{ marginBottom: "8px", fontSize: "13px", color: "#aaa" }}>
                  {post.timestamp}
                </p>
                <p style={{ marginBottom: "12px" }}>
                  {post.text || <em style={{ color: "#666" }}>No text</em>}
                </p>

                {/* Template quick-fill */}
                <div style={{ display: "flex", gap: "4px", marginBottom: "8px", flexWrap: "wrap" }}>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setCommentText(t.content)}
                      style={{ ...btnSmallStyle, background: "#374151" }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type comment..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={() => handleSend(post)}
                    disabled={sending || !commentText.trim()}
                    style={{ ...btnStyle, background: "#16a34a" }}
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Comments */}
      <div style={{ ...cardStyle, marginTop: "16px" }}>
        <h3 style={{ marginBottom: "12px" }}>Recent Comments</h3>
        {comments.length === 0 ? (
          <p style={{ color: "#666" }}>No comments yet</p>
        ) : (
          comments.slice(0, 10).map((c) => (
            <div
              key={c.id}
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #333",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{c.commentText.slice(0, 80)}</span>
              <span
                style={{
                  color: c.status === "sent" ? "#22c55e" : c.status === "failed" ? "#ef4444" : "#eab308",
                  fontSize: "12px",
                }}
              >
                {c.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ ...cardStyle, flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: "bold", color: color || "#fff" }}>{value}</div>
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

const btnSmallStyle: React.CSSProperties = {
  padding: "4px 8px",
  border: "none",
  borderRadius: "4px",
  color: "#e0e0e0",
  cursor: "pointer",
  fontSize: "12px",
};
