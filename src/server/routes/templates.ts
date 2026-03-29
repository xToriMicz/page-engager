import { Hono } from "hono";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

const app = new Hono();

// List all templates
app.get("/", async (c) => {
  const all = await db.select().from(schema.templates).all();
  return c.json(all);
});

// Add template
app.post("/", async (c) => {
  const body = await c.req.json<{ name: string; content: string; category?: string }>();
  if (!body.name || !body.content) {
    return c.json({ error: "name and content required" }, 400);
  }

  const result = await db
    .insert(schema.templates)
    .values({ name: body.name, content: body.content, category: body.category })
    .returning();

  return c.json(result[0], 201);
});

// Update template
app.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ name?: string; content?: string; category?: string }>();

  const result = await db
    .update(schema.templates)
    .set(body)
    .where(eq(schema.templates.id, id))
    .returning();

  if (!result.length) return c.json({ error: "not found" }, 404);
  return c.json(result[0]);
});

// Delete template
app.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db.delete(schema.templates).where(eq(schema.templates.id, id));
  return c.json({ ok: true });
});

export default app;
