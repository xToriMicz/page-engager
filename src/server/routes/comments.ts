import { Hono } from "hono";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";
import { scanTargetPosts, sendComment } from "../browser";

const app = new Hono();

// List comment history
app.get("/", async (c) => {
  const all = await db
    .select()
    .from(schema.comments)
    .orderBy(desc(schema.comments.createdAt))
    .limit(100)
    .all();
  return c.json(all);
});

// Scan posts of a target
app.post("/scan/:targetId", async (c) => {
  const targetId = Number(c.req.param("targetId"));

  const target = await db
    .select()
    .from(schema.targets)
    .where(eq(schema.targets.id, targetId))
    .get();

  if (!target) return c.json({ error: "target not found" }, 404);

  // Get active session cookies
  const session = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.active, true))
    .get();

  if (!session) return c.json({ error: "no active session. login first" }, 400);

  const posts = await scanTargetPosts(target.url, session.cookies);
  return c.json({ target: target.name, posts });
});

// Send comment (semi-auto)
app.post("/send", async (c) => {
  const body = await c.req.json<{
    targetId: number;
    postUrl: string;
    postText?: string;
    commentText: string;
    templateId?: number;
  }>();

  if (!body.postUrl || !body.commentText) {
    return c.json({ error: "postUrl and commentText required" }, 400);
  }

  const session = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.active, true))
    .get();

  if (!session) return c.json({ error: "no active session. login first" }, 400);

  // Record comment as pending
  const [comment] = await db
    .insert(schema.comments)
    .values({
      targetId: body.targetId,
      templateId: body.templateId,
      postUrl: body.postUrl,
      postText: body.postText,
      commentText: body.commentText,
      status: "pending",
    })
    .returning();

  // Send via Playwright
  const result = await sendComment(body.postUrl, body.commentText, session.cookies);

  // Update status
  await db
    .update(schema.comments)
    .set({
      status: result.success ? "sent" : "failed",
      sentAt: result.success ? new Date().toISOString() : null,
    })
    .where(eq(schema.comments.id, comment.id));

  return c.json({
    id: comment.id,
    status: result.success ? "sent" : "failed",
    error: result.error,
  });
});

export default app;
