import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { WebSocketServer, WebSocket } from "ws";
import { onPreview, isPreviewActive } from "../browser/preview";

const app = new Hono();
const wsClients = new Set<WebSocket>();

// WebSocket server on port 3001 — binary frame stream at 60 FPS
const wss = new WebSocketServer({ port: 3001 });
wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));
  ws.on("error", () => wsClients.delete(ws));
});
console.log("🎬 Preview WebSocket on ws://localhost:3001");

// Listen for frame events and broadcast as binary
onPreview((event) => {
  if (event.type === "frame" && wsClients.size > 0) {
    const buf = event.data as unknown as Buffer;
    for (const ws of wsClients) {
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 256 * 1024) {
        // Skip frame if buffer is backing up (prevents lag accumulation)
        ws.send(buf);
      }
    }
  }
});

// SSE stream — action log only (no frames)
app.get("/stream", (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: "status", data: JSON.stringify({ active: isPreviewActive() }) });

    const unsub = onPreview(async (event) => {
      if (event.type === "frame") return;
      try {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      } catch {
        unsub();
      }
    });

    const keepAlive = setInterval(async () => {
      try {
        await stream.writeSSE({ event: "ping", data: "{}" });
      } catch {
        clearInterval(keepAlive);
        unsub();
      }
    }, 15000);

    stream.onAbort(() => {
      clearInterval(keepAlive);
      unsub();
    });

    await new Promise(() => {});
  });
});

app.get("/status", (c) => {
  return c.json({ active: isPreviewActive(), wsPort: 3001 });
});

export default app;
