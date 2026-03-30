import { Hono } from "hono";
import { db, schema } from "../db";
import { eq, desc, sql } from "drizzle-orm";
import { scanTargetPosts, sendComment, getCurrentPage } from "../browser";
import { generateComment, analyzePost } from "../ai/generate-comment";
import { notifyActivity } from "./activity";

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

// Get last scan results (persisted)
app.get("/scan/:targetId", async (c) => {
  const targetId = Number(c.req.param("targetId"));
  const cached = await db.select().from(schema.scanCache)
    .where(eq(schema.scanCache.targetId, targetId))
    .orderBy(desc(schema.scanCache.scannedAt))
    .limit(1)
    .get();

  if (!cached) return c.json({ posts: [], scannedAt: null });

  const target = await db.select().from(schema.targets).where(eq(schema.targets.id, targetId)).get();
  return c.json({
    target: target?.name || "",
    posts: JSON.parse(cached.posts),
    scannedAt: cached.scannedAt,
  });
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

    // Save to scanCache for persistence
    await db.insert(schema.scanCache).values({
      targetId,
      posts: JSON.stringify(posts),
    });

    // Cleanup old scans — keep only 3 most recent per target
    const oldScans = await db.select({ id: schema.scanCache.id })
      .from(schema.scanCache)
      .where(eq(schema.scanCache.targetId, targetId))
      .orderBy(desc(schema.scanCache.scannedAt))
      .limit(100)
      .offset(3)
      .all();
    for (const old of oldScans) {
      await db.delete(schema.scanCache).where(eq(schema.scanCache.id, old.id));
    }

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

// Batch AI — analyze + generate for multiple posts in parallel
app.post("/batch-ai", async (c) => {
  const body = await c.req.json<{ posts: { text: string; index: number }[] }>();
  if (!body.posts?.length) return c.json({ error: "posts required" }, 400);

  const pageName = getCurrentPage() || "เพจ";
  const results = await Promise.all(
    body.posts.map(async (post) => {
      try {
        const [comment, analysis] = await Promise.all([
          generateComment(post.text, pageName),
          analyzePost(post.text),
        ]);
        return { index: post.index, comment, analysis };
      } catch {
        return { index: post.index, comment: "", analysis: { type: "normal", rating: 3, summary: "" } };
      }
    })
  );

  return c.json({ results });
});

// Generate comment — custom first, AI fallback
app.post("/generate", async (c) => {
  const body = await c.req.json<{ postText: string }>();
  if (!body.postText) return c.json({ error: "postText required" }, 400);

  // Check for custom comments first
  const customComments = await db.select().from(schema.templates)
    .where(eq(schema.templates.category, "custom")).all();

  if (customComments.length > 0) {
    const pick = customComments[Math.floor(Math.random() * customComments.length)];
    return c.json({ comment: pick.content, source: "custom" });
  }

  // AI generate
  try {
    const pageName = getCurrentPage() || "เพจ";
    const comment = await generateComment(body.postText, pageName);
    return c.json({ comment, source: "ai" });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// AI analyze post type + rating
app.post("/analyze", async (c) => {
  const body = await c.req.json<{ postText: string }>();
  if (!body.postText) return c.json({ error: "postText required" }, 400);
  try {
    const analysis = await analyzePost(body.postText);
    return c.json(analysis);
  } catch (e: any) {
    return c.json({ type: "normal", rating: 3, summary: "วิเคราะห์ไม่ได้" });
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

  // Validate comment text
  const commentText = body.commentText.trim().replace(/<[^>]*>/g, "");
  if (commentText.length < 3 || commentText.length > 500) {
    return c.json({ error: "Comment must be 3-500 characters" }, 400);
  }
  body.commentText = commentText;

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

    const status = result.success ? "sent" : "failed";
    notifyActivity("comment_" + status, { targetId: body.targetId, postUrl: body.postUrl, comment: body.commentText.slice(0, 100) });

    return c.json({ id: comment.id, status, error: result.error });
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
