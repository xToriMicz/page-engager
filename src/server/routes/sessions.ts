import { Hono } from "hono";
import { isConnected, getChromeInfo, closeBrowser } from "../browser";

const app = new Hono();

// Check Chrome connection status
app.get("/status", async (c) => {
  const info = await getChromeInfo();
  return c.json(info);
});

// Close Playwright connection
app.post("/close-browser", async (c) => {
  await closeBrowser();
  return c.json({ message: "Browser disconnected" });
});

export default app;
