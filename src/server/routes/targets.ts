import { Hono } from "hono";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

const app = new Hono();

// List all targets
app.get("/", async (c) => {
  const all = await db.select().from(schema.targets).all();
  return c.json(all);
});

// Add target
app.post("/", async (c) => {
  const body = await c.req.json<{ name: string; url: string }>();
  if (!body.name || !body.url) {
    return c.json({ error: "name and url required" }, 400);
  }

  // Extract page ID from URL if possible
  const pageId = extractPageId(body.url);

  const result = await db
    .insert(schema.targets)
    .values({ name: body.name, url: body.url, pageId })
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

function extractPageId(url: string): string | null {
  const match = url.match(/facebook\.com\/(?:pages\/[^/]+\/)?(\d+)|facebook\.com\/([a-zA-Z0-9.]+)/);
  if (match) return match[1] || match[2] || null;
  return null;
}

export default app;
