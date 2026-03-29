import { useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Targets } from "./pages/Targets";
import { Templates } from "./pages/Templates";
import { Sessions } from "./pages/Sessions";

type Page = "dashboard" | "targets" | "templates" | "sessions";

export function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={navStyle}>
        <h2 style={{ padding: "20px", fontSize: "18px", borderBottom: "1px solid #333" }}>
          Page Engager
        </h2>
        {(["dashboard", "targets", "templates", "sessions"] as Page[]).map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            style={{
              ...navBtnStyle,
              background: page === p ? "#2563eb" : "transparent",
            }}
          >
            {p === "dashboard" && "Dashboard"}
            {p === "targets" && "Target Pages"}
            {p === "templates" && "Templates"}
            {p === "sessions" && "Sessions"}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, padding: "24px" }}>
        {page === "dashboard" && <Dashboard />}
        {page === "targets" && <Targets />}
        {page === "templates" && <Templates />}
        {page === "sessions" && <Sessions />}
      </main>
    </div>
  );
}

const navStyle: React.CSSProperties = {
  width: "220px",
  background: "#1a1a1a",
  borderRight: "1px solid #333",
  display: "flex",
  flexDirection: "column",
};

const navBtnStyle: React.CSSProperties = {
  padding: "12px 20px",
  border: "none",
  color: "#e0e0e0",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "14px",
};
