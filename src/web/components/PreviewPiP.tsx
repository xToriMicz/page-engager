import { useState, useEffect, useRef } from "react";
import { Badge } from "./ui";

export function PreviewPiP() {
  const imgRef = useRef<HTMLImageElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [active, setActive] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [lastAction, setLastAction] = useState("");
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);

  // FPS counter
  useEffect(() => {
    const timer = setInterval(() => {
      setFps(frameCount.current);
      frameCount.current = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // WebSocket for binary frames
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");
    ws.binaryType = "blob";

    ws.onmessage = (e) => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(e.data as Blob);
      blobUrlRef.current = url;
      if (imgRef.current) imgRef.current.src = url;
      if (!hasFrame) setHasFrame(true);
      frameCount.current++;
    };

    return () => {
      ws.close();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // SSE for actions
  useEffect(() => {
    const es = new EventSource("/api/preview/stream");

    const parse = (e: MessageEvent) => { try { return JSON.parse(e.data); } catch { return null; } };

    es.addEventListener("action", (e) => {
      const d = parse(e); if (!d) return;
      setActive(true);
      setMinimized(false); // auto-show when action starts
      setLastAction(d.data);
    });

    es.addEventListener("status", (e) => {
      const d = parse(e); if (!d) return;
      if (d.active !== undefined) setActive(d.active);
    });

    es.addEventListener("done", (e) => {
      const d = parse(e); if (!d) return;
      setActive(false);
      setLastAction(d.data);
    });

    return () => es.close();
  }, []);

  // Don't render if never had a frame and not active
  if (!hasFrame && !active) return null;

  // Minimized: just a small floating button
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className={`fixed bottom-20 md:bottom-4 right-4 z-50 w-10 h-10 rounded-full shadow-lg border border-ring flex items-center justify-center cursor-pointer transition-all ${
          active ? "bg-red-600 text-white animate-pulse" : "bg-surface text-muted"
        }`}
      >
        P
      </button>
    );
  }

  const sizeClass = expanded
    ? "w-[640px] h-[420px]"
    : "w-[320px] h-[220px]";

  return (
    <div className={`fixed bottom-20 md:bottom-4 right-4 z-50 ${sizeClass} transition-all duration-300 ease-out`}>
      <div className="w-full h-full bg-black rounded-[var(--radius-lg)] shadow-2xl border border-ring/50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-1 bg-surface/90 border-b border-ring/30 shrink-0">
          <div className="flex items-center gap-1.5">
            {active && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-600/90 text-white text-[8px] font-bold rounded-full">
                <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                LIVE
              </span>
            )}
            {fps > 0 && active && (
              <span className="text-[8px] text-subtle">{fps}fps</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-5 h-5 flex items-center justify-center text-[10px] text-muted hover:text-foreground bg-transparent border-none cursor-pointer"
              title={expanded ? "Shrink" : "Expand"}
            >
              {expanded ? "−" : "□"}
            </button>
            <button
              onClick={() => setMinimized(true)}
              className="w-5 h-5 flex items-center justify-center text-[10px] text-muted hover:text-foreground bg-transparent border-none cursor-pointer"
              title="Minimize"
            >
              _
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="flex-1 relative overflow-hidden">
          {hasFrame ? (
            <img
              ref={imgRef}
              alt=""
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-subtle text-xs">
              {active ? "Starting..." : "Idle"}
            </div>
          )}
        </div>

        {/* Action bar */}
        {lastAction && (
          <div className="px-2 py-1 bg-surface/90 border-t border-ring/30 shrink-0">
            <p className="text-[9px] text-muted truncate">{lastAction}</p>
          </div>
        )}
      </div>
    </div>
  );
}
