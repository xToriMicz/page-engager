import { Hono } from "hono";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { fetchPageName as fetchPageNameViaPlaywright } from "../browser";
import { discoverEngagers } from "../browser/discover";

const app = new Hono();

// List all targets
app.get("/", async (c) => {
  const all = await db.select().from(schema.targets).all();
  return c.json(all);
});

// Fetch page name from Facebook URL
app.post("/resolve", async (c) => {
  const body = await c.req.json<{ url: string }>();
  if (!body.url) return c.json({ error: "url required" }, 400);

  try {
    const name = await fetchPageName(body.url);
    return c.json({ name, url: body.url });
  } catch (e) {
    console.error("resolve error:", e);
    return c.json({ name: "", url: body.url });
  }
});

// Discover engagers from our own page
app.post("/discover", async (c) => {
  const body = await c.req.json<{ pageUrl: string; postsToScan?: number }>();
  if (!body.pageUrl) return c.json({ error: "pageUrl required" }, 400);

  try {
    const engagers = await discoverEngagers(body.pageUrl, body.postsToScan || 5);
    return c.json({ engagers, total: engagers.length });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Add target from discovered engager (or manual)
app.post("/", async (c) => {
  const body = await c.req.json<{ name?: string; url: string }>();
  if (!body.url) {
    return c.json({ error: "url required" }, 400);
  }

  // Auto-fetch name if not provided
  let name = body.name?.trim();
  if (!name) {
    try {
      name = await fetchPageName(body.url);
    } catch {
      name = body.url;
    }
  }

  const pageId = extractPageId(body.url);

  const result = await db
    .insert(schema.targets)
    .values({ name, url: body.url, pageId })
    .returning();

  return c.json(result[0], 201);
});

// Update target
app.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ name?: string; url?: string; active?: boolean }>();

  const result = await db
    .update(schema.targets)
    .set(body)
    .where(eq(schema.targets.id, id))
    .returning();

  if (!result.length) return c.json({ error: "not found" }, 404);
  return c.json(result[0]);
});

// Delete target (and its comments)
app.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  try {
    await db.delete(schema.comments).where(eq(schema.comments.targetId, id));
    await db.delete(schema.targets).where(eq(schema.targets.id, id));
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

async function fetchPageName(url: string): Promise<string> {
  return fetchPageNameViaPlaywright(url);
}

function extractPageId(url: string): string | null {
  // profile.php?id=100083118565344
  const idMatch = url.match(/[?&]id=(\d+)/);
  if (idMatch) return idMatch[1];
  // facebook.com/pages/Name/123456 or facebook.com/123456
  const pathMatch = url.match(/facebook\.com\/(?:pages\/[^/]+\/)?(\d+)/);
  if (pathMatch) return pathMatch[1];
  // facebook.com/vanityname
  const vanityMatch = url.match(/facebook\.com\/([a-zA-Z0-9.]+)\/?(\?|$)/);
  if (vanityMatch && !["profile.php", "pages", "groups", "watch"].includes(vanityMatch[1])) {
    return vanityMatch[1];
  }
  return null;
}

export default app;
