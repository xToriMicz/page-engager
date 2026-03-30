import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { WebSocketServer, WebSocket } from "ws";
import { onPreview, isPreviewActive, addClient, removeClient } from "../browser/preview";

const app = new Hono();
const wsClients = new Set<WebSocket>();

const WS_PORT = parseInt(process.env.WS_PORT || "3001");
const wss = new WebSocketServer({ port: WS_PORT });
wss.on("connection", (ws) => {
  wsClients.add(ws);
  addClient();
  ws.on("close", () => { wsClients.delete(ws); removeClient(); });
  ws.on("error", () => { wsClients.delete(ws); removeClient(); });
});
console.log(`🎬 Preview WebSocket on ws://localhost:${WS_PORT}`);

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
  return c.json({ active: isPreviewActive(), wsPort: WS_PORT });
});

export default app;
