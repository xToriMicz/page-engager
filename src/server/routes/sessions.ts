import { Hono } from "hono";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { openLoginPage, captureCookies, closeBrowser } from "../browser";

const app = new Hono();

// List sessions
app.get("/", async (c) => {
  const all = await db.select().from(schema.sessions).all();
  // Don't expose full cookie data in list
  return c.json(
    all.map((s) => ({
      id: s.id,
      name: s.name,
      active: s.active,
      createdAt: s.createdAt,
    }))
  );
});

// Open browser for manual login
app.post("/login", async (c) => {
  const message = await openLoginPage();
  return c.json({ message });
});

// Capture cookies after manual login
app.post("/capture", async (c) => {
  const body = await c.req.json<{ name: string }>();
  if (!body.name) return c.json({ error: "name required" }, 400);

  try {
    const cookies = await captureCookies();

    // Deactivate other sessions
    await db.update(schema.sessions).set({ active: false });

    const [session] = await db
      .insert(schema.sessions)
      .values({ name: body.name, cookies, active: true })
      .returning();

    return c.json({ id: session.id, name: session.name, message: "Session captured" }, 201);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to capture cookies" },
      400
    );
  }
});

// Set active session
app.put("/:id/activate", async (c) => {
  const id = Number(c.req.param("id"));
  await db.update(schema.sessions).set({ active: false });
  const result = await db
    .update(schema.sessions)
    .set({ active: true })
    .where(eq(schema.sessions.id, id))
    .returning();

  if (!result.length) return c.json({ error: "not found" }, 404);
  return c.json(result[0]);
});

// Delete session
app.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
  return c.json({ ok: true });
});

// Close browser
app.post("/close-browser", async (c) => {
  await closeBrowser();
  return c.json({ message: "Browser closed" });
});

export default app;
