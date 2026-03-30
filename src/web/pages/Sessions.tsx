import { useState, useEffect } from "react";
import * as api from "../lib/client";

export function Sessions() {
  const [status, setStatus] = useState<{ browser: string; connected: boolean } | null>(null);
  const [checking, setChecking] = useState(true);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const s = await api.getChromeStatus();
      setStatus(s);
    } catch {
      setStatus({ browser: "", connected: false });
    }
    setChecking(false);
  };

  useEffect(() => { checkStatus(); }, []);

  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>Chrome Connection</h1>

      <div style={{ ...cardStyle, marginBottom: "16px" }}>
        <h3 style={{ marginBottom: "12px" }}>Status</h3>
        {checking ? (
          <p style={{ color: "#888" }}>Checking...</p>
        ) : status?.connected ? (
          <div>
            <p style={{ color: "#22c55e", fontSize: "16px", fontWeight: "bold", marginBottom: "8px" }}>
              Connected
            </p>
            <p style={{ color: "#888", fontSize: "13px" }}>{status.browser}</p>
          </div>
        ) : (
          <div>
            <p style={{ color: "#ef4444", fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
              Not Connected
            </p>
            <p style={{ color: "#888", fontSize: "13px", marginBottom: "12px" }}>
              Start Chrome with debug port to connect:
            </p>
            <code style={{
              display: "block",
              padding: "12px",
              background: "#2a2a2a",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#f97316",
              wordBreak: "break-all",
              marginBottom: "12px",
            }}>
              /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
            </code>
            <p style={{ color: "#888", fontSize: "13px" }}>
              Then click Refresh below to connect.
            </p>
          </div>
        )}
        <button
          onClick={checkStatus}
          style={{ ...btnStyle, marginTop: "12px" }}
          disabled={checking}
        >
          {checking ? "Checking..." : "Refresh Status"}
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginBottom: "12px" }}>How it works</h3>
        <ol style={{ paddingLeft: "20px", lineHeight: "1.8", color: "#aaa", fontSize: "13px" }}>
          <li>Start Chrome with <code>--remote-debugging-port=9222</code></li>
          <li>Login to Facebook in Chrome as your page</li>
          <li>Come back here and click Refresh Status</li>
          <li>Go to Target Pages to add pages to engage</li>
          <li>Go to Dashboard to scan posts and send comments</li>
        </ol>
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

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#2563eb",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  cursor: "pointer",
  fontSize: "14px",
};
