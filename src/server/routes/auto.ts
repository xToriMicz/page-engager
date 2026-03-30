import { Hono } from "hono";
import { db, schema } from "../db";
import { eq, desc, inArray } from "drizzle-orm";
import { scanTargetPosts, sendComment, ensurePageProfile, connectToChrome, getCurrentPage } from "../browser";
import { generateComment } from "../ai/generate-comment";
import { emitAction, emitDone, emitError, emitStatus, setPreviewActive, startScreencast } from "../browser/preview";
import { notifyActivity } from "./activity";
import { getSetting, setSetting } from "../db/settings";

const app = new Hono();

let autoRunning = false;
let autoAbort = false;

// Normalize Facebook URL to prevent duplicate comments on same post
function normalizePostUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove tracking params, keep only essential path
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.split("?")[0].replace(/\/$/, "");
  }
}

// Get auto config
app.get("/config", (c) => {
  const maxPostsPerTarget = +(getSetting("auto_maxPosts") || "3");
  const roundsPerDay = +(getSetting("auto_roundsPerDay") || "1");
  const delayBetweenComments = +(getSetting("auto_delay") || "60"); // seconds
  return c.json({ maxPostsPerTarget, roundsPerDay, delayBetweenComments });
});

// Set auto config
app.post("/config", async (c) => {
  const body = await c.req.json<{ maxPostsPerTarget?: number; roundsPerDay?: number; delayBetweenComments?: number }>();
  if (body.maxPostsPerTarget) setSetting("auto_maxPosts", String(Math.min(5, Math.max(1, body.maxPostsPerTarget))));
  if (body.roundsPerDay) setSetting("auto_roundsPerDay", String(Math.min(24, Math.max(1, body.roundsPerDay))));
  if (body.delayBetweenComments) setSetting("auto_delay", String(Math.min(300, Math.max(30, body.delayBetweenComments))));
  return c.json({ ok: true });
});

// Get status
app.get("/status", (c) => {
  return c.json({ running: autoRunning });
});

// Stop auto
app.post("/stop", (c) => {
  autoAbort = true;
  return c.json({ ok: true });
});

// Run 1 round of auto-engage
app.post("/run", async (c) => {
  if (autoRunning) return c.json({ error: "Already running — stop first" }, 409);

  autoRunning = true;
  autoAbort = false;
  const autoTimeout = setTimeout(() => { autoAbort = true; }, 30 * 60 * 1000); // 30min max
  setPreviewActive(true);

  const maxPostsPerTarget = +(getSetting("auto_maxPosts") || "3");
  const delaySeconds = +(getSetting("auto_delay") || "60");
  const pageName = getCurrentPage() || "เพจ";

  try {
    // Get all active targets
    const targets = await db.select().from(schema.targets).where(eq(schema.targets.active, true)).all();
    if (targets.length === 0) {
      emitError("No targets found");
      return c.json({ error: "No targets" }, 400);
    }

    // Get all previously commented post URLs to avoid duplicates
    const previousComments = await db.select({ postUrl: schema.comments.postUrl })
      .from(schema.comments)
      .where(eq(schema.comments.status, "sent"))
      .all();
    const commentedUrls = new Set(previousComments.map((c) => normalizePostUrl(c.postUrl)));

    emitStatus(`Auto-engage: ${targets.length} targets, max ${maxPostsPerTarget} posts each`);

    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // Ensure page profile once
    const ctx = await connectToChrome();
    const profilePage = await ctx.newPage();
    const stopCapture = await startScreencast(profilePage);
    try {
      await ensurePageProfile(profilePage);
    } finally {
      stopCapture();
      await profilePage.close();
    }

    for (let ti = 0; ti < targets.length; ti++) {
      if (autoAbort) { emitAction("Stopped by user"); break; }

      const target = targets[ti];
      emitAction(`[${ti + 1}/${targets.length}] Scanning: ${target.name}`);

      // Scan posts
      let posts: any[];
      try {
        posts = await scanTargetPosts(target.url, maxPostsPerTarget + 5); // scan extra to have room after filtering
      } catch (e: any) {
        emitError(`Scan failed for ${target.name}: ${e.message}`);
        continue;
      }

      // Filter: remove already commented posts (normalized URL match)
      const newPosts = posts.filter((p) => p.url && !commentedUrls.has(normalizePostUrl(p.url)));
      const toComment = newPosts.slice(0, maxPostsPerTarget);

      emitAction(`${target.name}: ${posts.length} posts found, ${newPosts.length} new, commenting on ${toComment.length}`);

      for (let pi = 0; pi < toComment.length; pi++) {
        if (autoAbort) break;
        const post = toComment[pi];

        // Pick comment based on post content
        emitAction(`Preparing comment for post ${pi + 1}/${toComment.length}...`);
        let commentText: string;
        const hasCaption = post.text && post.text.trim().length > 10;

        // Greeting comments for posts without caption (photo/video only)
        const GREETING_COMMENTS = [
          "สวัสดีครับ ทักทายครับ",
          "แวะมาเยี่ยมครับ",
          "ติดตามแล้วนะครับ",
          "สวัสดีครับ แวะมาทักทาย",
          "มาเยี่ยมชมครับ สู้ๆ นะครับ",
          "ทักทายครับ ติดตามผลงานอยู่นะ",
        ];

        if (!hasCaption) {
          // No caption → use greeting
          commentText = GREETING_COMMENTS[Math.floor(Math.random() * GREETING_COMMENTS.length)];
          emitAction(`No caption → greeting: "${commentText}"`);
        } else {
          // Has caption → custom comments or AI
          const customComments = await db.select().from(schema.templates)
            .where(eq(schema.templates.category, "custom")).all();

          if (customComments.length > 0) {
            const pick = customComments[Math.floor(Math.random() * customComments.length)];
            commentText = pick.content;
            emitAction(`Using custom: "${commentText.slice(0, 40)}..."`);
          } else {
            try {
              commentText = await generateComment(post.text, pageName);
              emitAction(`AI generated: "${commentText.slice(0, 40)}..."`);
            } catch {
              emitError(`AI failed, using greeting`);
              commentText = GREETING_COMMENTS[Math.floor(Math.random() * GREETING_COMMENTS.length)];
            }
          }
        }

        // Validate comment: 3-500 chars, no scripts
        commentText = commentText.trim();
        if (commentText.length < 3 || commentText.length > 500) {
          totalSkipped++;
          continue;
        }
        commentText = commentText.replace(/<[^>]*>/g, ""); // strip HTML tags

        const normalizedUrl = normalizePostUrl(post.url);

        // Save to DB as pending
        const [record] = await db.insert(schema.comments).values({
          targetId: target.id,
          postUrl: normalizedUrl,
          postText: post.text,
          commentText,
          status: "pending",
        }).returning();

        // Send comment
        emitAction(`Sending comment to ${target.name} post ${pi + 1}...`);
        try {
          const result = await sendComment(post.url, commentText);

          if (result.success) {
            await db.update(schema.comments).set({
              status: "sent",
              sentAt: new Date().toISOString(),
            }).where(eq(schema.comments.id, record.id));
            commentedUrls.add(normalizedUrl); // prevent re-commenting in same run
            totalSent++;
            emitAction(`Sent to ${target.name}: "${commentText.slice(0, 40)}..."`);
            notifyActivity("auto_comment_sent", { target: target.name, postUrl: post.url });
          } else {
            await db.update(schema.comments).set({ status: "failed" }).where(eq(schema.comments.id, record.id));
            totalFailed++;
            emitError(`Failed: ${result.error}`);
          }
        } catch (e: any) {
          await db.update(schema.comments).set({ status: "failed" }).where(eq(schema.comments.id, record.id));
          totalFailed++;
          emitError(`Send error: ${e.message}`);
        }

        // Delay between comments (human-like)
        if (pi < toComment.length - 1 || ti < targets.length - 1) {
          const delay = delaySeconds + Math.floor(Math.random() * 30);
          emitStatus(`Waiting ${delay}s before next comment...`);
          for (let w = 0; w < delay && !autoAbort; w++) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
    }

    const summary = `Auto-engage done: ${totalSent} sent, ${totalSkipped} skipped, ${totalFailed} failed`;
    emitDone(summary);
    return c.json({ sent: totalSent, skipped: totalSkipped, failed: totalFailed });
  } catch (e: any) {
    emitError(`Auto-engage error: ${e.message}`);
    return c.json({ error: e.message }, 500);
  } finally {
    clearTimeout(autoTimeout);
    autoRunning = false;
    autoAbort = false;
    setPreviewActive(false);
  }
});

export default app;
