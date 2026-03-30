import { Hono } from "hono";
import { isConnected, getChromeInfo, closeBrowser, listManagedPages, switchToPage, getCurrentPage } from "../browser";

const app = new Hono();

// Check Chrome connection status
app.get("/status", async (c) => {
  const info = await getChromeInfo();
  return c.json({ ...info, currentPage: getCurrentPage() });
});

// List managed pages (cached)
let cachedPages: { name: string; url: string }[] | null = null;

const NOISE = ["Meta Business Suite", "กล่องข้อความ", "ข้อมูลเชิงลึก", "ดูทั้งหมด"];
const NOISE_PATTERNS = ["ได้แสดง", "ยังไม่ได้อ่าน", "เพิ่มโพสต์", "ติดตามคุณ", "ถูกใจ", "กล่าวถึง"];

function filterPages(pages: { name: string; url: string }[]) {
  return pages.filter((p) =>
    p.name.length < 50 &&
    !NOISE.includes(p.name) &&
    !NOISE_PATTERNS.some((n) => p.name.includes(n))
  );
}

app.get("/pages", async (c) => {
  try {
    if (cachedPages) {
      return c.json({ pages: cachedPages, currentPage: getCurrentPage(), cached: true });
    }
    const raw = await listManagedPages();
    cachedPages = filterPages(raw);
    return c.json({ pages: cachedPages, currentPage: getCurrentPage(), cached: false });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Force refresh pages cache
app.post("/pages/refresh", async (c) => {
  try {
    const raw = await listManagedPages();
    cachedPages = filterPages(raw);
    return c.json({ pages: cachedPages, currentPage: getCurrentPage() });
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

// Screenshot current browser state (monitor for headless mode)
app.get("/screenshot", async (c) => {
  try {
    const { connectToChrome } = await import("../browser");
    const ctx = await connectToChrome();
    const pages = ctx.pages();
    if (pages.length === 0) return c.json({ error: "no pages open" }, 404);
    const screenshot = await pages[pages.length - 1].screenshot({ type: "png" });
    return new Response(screenshot, { headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Close Playwright connection
app.post("/close-browser", async (c) => {
  await closeBrowser();
  return c.json({ message: "Browser disconnected" });
});

export default app;
