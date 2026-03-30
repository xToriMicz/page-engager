import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardTitle, Badge } from "../components/ui";

interface LogEntry {
  type: "action" | "status" | "error" | "done";
  data: string;
  timestamp: string;
}

export function Preview() {
  const imgRef = useRef<HTMLImageElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [fps, setFps] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const frameCount = useRef(0);

  // FPS counter
  useEffect(() => {
    const timer = setInterval(() => {
      setFps(frameCount.current);
      frameCount.current = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // WebSocket for binary frames — much faster than SSE base64
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");
    ws.binaryType = "blob";

    ws.onmessage = (e) => {
      // Revoke old blob URL to prevent memory leak
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);

      const url = URL.createObjectURL(e.data as Blob);
      blobUrlRef.current = url;
      if (imgRef.current) imgRef.current.src = url;
      if (!hasFrame) setHasFrame(true);
      frameCount.current++;
    };

    ws.onclose = () => setConnected((c) => c); // SSE handles connected state

    return () => {
      ws.close();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // SSE for action log only
  useEffect(() => {
    const es = new EventSource("/api/preview/stream");

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const parseSSE = (e: MessageEvent) => {
      try { return JSON.parse(e.data); } catch { return null; }
    };

    es.addEventListener("action", (e) => {
      const data = parseSSE(e); if (!data) return;
      setActive(true);
      setLogs((prev) => [...prev.slice(-100), { type: "action", data: data.data, timestamp: data.timestamp }]);
    });

    es.addEventListener("status", (e) => {
      const data = parseSSE(e); if (!data) return;
      if (data.active !== undefined) setActive(data.active);
      else {
        setActive(true);
        setLogs((prev) => [...prev.slice(-100), { type: "status", data: data.data, timestamp: data.timestamp }]);
      }
    });

    es.addEventListener("error", (e) => {
      const data = parseSSE(e); if (!data) return;
      setLogs((prev) => [...prev.slice(-100), { type: "error", data: data.data, timestamp: data.timestamp }]);
    });

    es.addEventListener("done", (e) => {
      const data = parseSSE(e); if (!data) return;
      setActive(false);
      setLogs((prev) => [...prev.slice(-100), { type: "done", data: data.data, timestamp: data.timestamp }]);
    });

    return () => es.close();
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch { return ""; }
  };

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${active ? "bg-success animate-pulse" : connected ? "bg-muted" : "bg-danger"}`} />
          <span className="text-sm text-muted">
            {active ? "Working..." : connected ? "Idle — waiting for action" : "Disconnected"}
          </span>
        </div>
        <Badge variant={connected ? "success" : "danger"}>
          {connected ? "Live" : "Offline"}
        </Badge>
      </div>

      {/* Video-like preview — direct img.src update via WebSocket binary */}
      <div className="relative bg-black rounded-[var(--radius-lg)] overflow-hidden">
        {hasFrame ? (
          <>
            <img
              ref={imgRef}
              alt="Browser preview"
              className="w-full h-auto block"
              style={{ aspectRatio: "16/10" }}
            />
            {active && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600/90 text-white text-[10px] font-bold rounded-full shadow-lg">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  LIVE
                </span>
                {fps > 0 && (
                  <span className="px-2 py-1 bg-black/60 text-white/80 text-[10px] rounded-full">
                    {fps} fps
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 md:h-96 text-subtle text-sm gap-2">
            <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center text-lg">P</div>
            {active ? "Waiting for first frame..." : "Start an action to see live preview"}
          </div>
        )}
      </div>

      {/* Action log */}
      <Card>
        <CardTitle>Action Log</CardTitle>
        <div ref={logRef} className="mt-3 max-h-64 overflow-y-auto space-y-0.5 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-subtle py-4 text-center">No actions yet</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`flex gap-2 py-1 px-2 rounded-[var(--radius-sm)] ${i === logs.length - 1 ? "bg-primary/5" : ""}`}>
                <span className="text-subtle shrink-0 tabular-nums">{formatTime(log.timestamp)}</span>
                <span className={
                  log.type === "error" ? "text-danger" :
                  log.type === "done" ? "text-success font-medium" :
                  log.type === "status" ? "text-primary" :
                  "text-foreground"
                }>
                  {log.type === "error" && "ERROR: "}
                  {log.type === "done" && "DONE: "}
                  {log.data}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
