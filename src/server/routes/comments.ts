import { Hono } from "hono";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";
import { scanTargetPosts, sendComment, getCurrentPage } from "../browser";
import { generateComment } from "../ai/generate-comment";

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

  try {
    const posts = await scanTargetPosts(target.url);
    return c.json({ target: target.name, posts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("scan error:", msg);
    if (msg.includes("connect") || msg.includes("ECONNREFUSED")) {
      return c.json({
        error: "Cannot connect to Chrome. Start Chrome with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222",
      }, 400);
    }
    return c.json({ error: msg }, 500);
  }
});

// AI generate comment from post content
app.post("/generate", async (c) => {
  const body = await c.req.json<{ postText: string }>();
  if (!body.postText) return c.json({ error: "postText required" }, 400);

  try {
    const pageName = getCurrentPage() || "เพจ";
    const comment = await generateComment(body.postText, pageName);
    return c.json({ comment });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
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

  try {
    const result = await sendComment(body.postUrl, body.commentText);

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
  } catch (e) {
    await db
      .update(schema.comments)
      .set({ status: "failed" })
      .where(eq(schema.comments.id, comment.id));

    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ id: comment.id, status: "failed", error: msg });
  }
});

export default app;
