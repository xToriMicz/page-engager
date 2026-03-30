import { Hono } from "hono";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { fetchPageName as fetchPageNameViaPlaywright } from "../browser";

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

// Add target
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

// Delete target
app.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db.delete(schema.targets).where(eq(schema.targets.id, id));
  return c.json({ ok: true });
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
