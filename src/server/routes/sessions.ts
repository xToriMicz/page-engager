import { Hono } from "hono";
import { isConnected, getChromeInfo, closeBrowser, listManagedPages, switchToPage, getCurrentPage } from "../browser";

const app = new Hono();

// Check Chrome connection status
app.get("/status", async (c) => {
  const info = await getChromeInfo();
  return c.json({ ...info, currentPage: getCurrentPage() });
});

// List managed pages
app.get("/pages", async (c) => {
  try {
    const pages = await listManagedPages();
    return c.json({ pages, currentPage: getCurrentPage() });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Switch to a page
app.post("/switch-page", async (c) => {
  const { pageName } = await c.req.json();
  if (!pageName) return c.json({ error: "pageName required" }, 400);

  const result = await switchToPage(pageName);
  return c.json(result);
});

// Close Playwright connection
app.post("/close-browser", async (c) => {
  await closeBrowser();
  return c.json({ message: "Browser disconnected" });
});

export default app;
