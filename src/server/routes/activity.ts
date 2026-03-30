import { Hono } from "hono";
import { db, schema } from "../db";
import { desc, sql, eq } from "drizzle-orm";

const app = new Hono();

// Activity log — all actions with timestamps
app.get("/log", async (c) => {
  const limit = Math.min(100, +(c.req.query("limit") || "50"));
  const comments = await db
    .select({
      id: schema.comments.id,
      targetId: schema.comments.targetId,
      postUrl: schema.comments.postUrl,
      commentText: schema.comments.commentText,
      status: schema.comments.status,
      sentAt: schema.comments.sentAt,
      createdAt: schema.comments.createdAt,
    })
    .from(schema.comments)
    .orderBy(desc(schema.comments.createdAt))
    .limit(limit)
    .all();

  // Enrich with target names
  const targets = await db.select().from(schema.targets).all();
  const targetMap = new Map(targets.map((t) => [t.id, t.name]));

  const log = comments.map((c) => ({
    ...c,
    targetName: targetMap.get(c.targetId!) || "Unknown",
    type: c.status === "sent" ? "comment_sent" : c.status === "failed" ? "comment_failed" : "comment_pending",
  }));

  return c.json({ log, total: log.length });
});

// Daily report
app.get("/report", async (c) => {
  const days = +(c.req.query("days") || "7");
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const comments = await db
    .select()
    .from(schema.comments)
    .where(sql`${schema.comments.createdAt} >= ${since}`)
    .all();

  const targets = await db.select().from(schema.targets).all();
  const targetMap = new Map(targets.map((t) => [t.id, t.name]));

  // Group by day
  const byDay: Record<string, { sent: number; failed: number; total: number }> = {};
  for (const c of comments) {
    const day = c.createdAt.split("T")[0];
    if (!byDay[day]) byDay[day] = { sent: 0, failed: 0, total: 0 };
    byDay[day].total++;
    if (c.status === "sent") byDay[day].sent++;
    if (c.status === "failed") byDay[day].failed++;
  }

  // Group by target
  const byTarget: Record<string, { sent: number; failed: number; name: string }> = {};
  for (const c of comments) {
    const key = String(c.targetId);
    if (!byTarget[key]) byTarget[key] = { sent: 0, failed: 0, name: targetMap.get(c.targetId!) || "Unknown" };
    if (c.status === "sent") byTarget[key].sent++;
    if (c.status === "failed") byTarget[key].failed++;
  }

  return c.json({
    period: `${days} days`,
    summary: {
      totalComments: comments.length,
      sent: comments.filter((c) => c.status === "sent").length,
      failed: comments.filter((c) => c.status === "failed").length,
      targets: targets.length,
    },
    byDay: Object.entries(byDay).sort().map(([date, stats]) => ({ date, ...stats })),
    byTarget: Object.values(byTarget).sort((a, b) => b.sent - a.sent),
  });
});

// Stats for dashboard
app.get("/stats", async (c) => {
  const today = new Date().toISOString().split("T")[0];

  const totalSent = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.comments)
    .where(eq(schema.comments.status, "sent"))
    .get();

  const todaySent = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.comments)
    .where(sql`${schema.comments.status} = 'sent' AND ${schema.comments.createdAt} >= ${today}`)
    .get();

  const totalTargets = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.targets)
    .get();

  const todayFailed = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.comments)
    .where(sql`${schema.comments.status} = 'failed' AND ${schema.comments.createdAt} >= ${today}`)
    .get();

  return c.json({
    totalSent: totalSent?.count || 0,
    todaySent: todaySent?.count || 0,
    todayFailed: todayFailed?.count || 0,
    targets: totalTargets?.count || 0,
  });
});

// Send report to facebook-toolkit API
app.post("/send-report", async (c) => {
  const FB_TOOLKIT_URL = process.env.FB_TOOLKIT_URL || "https://fb.makeloops.xyz";

  const today = new Date().toISOString().split("T")[0];
  const comments = await db
    .select()
    .from(schema.comments)
    .where(sql`${schema.comments.createdAt} >= ${today}`)
    .all();

  const targets = await db.select().from(schema.targets).all();
  const targetMap = new Map(targets.map((t) => [t.id, t.name]));

  const report = {
    date: today,
    source: "page-engager",
    totalComments: comments.length,
    sent: comments.filter((c) => c.status === "sent").length,
    failed: comments.filter((c) => c.status === "failed").length,
    targets: targets.map((t) => t.name),
    details: comments.slice(0, 20).map((c) => ({
      target: targetMap.get(c.targetId!) || "Unknown",
      comment: c.commentText.slice(0, 100),
      status: c.status,
      time: c.createdAt,
    })),
  };

  try {
    const res = await fetch(`${FB_TOOLKIT_URL}/api/engagement-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });

    if (res.ok) {
      return c.json({ success: true, message: "Report sent to facebook-toolkit" });
    } else {
      return c.json({ success: false, error: `HTTP ${res.status}` });
    }
  } catch (e: any) {
    // Fallback: just return the report data
    return c.json({ success: false, report, error: e.message });
  }
});

// Notification webhook — call after each comment
export async function notifyActivity(action: string, data: any) {
  const FB_TOOLKIT_URL = process.env.FB_TOOLKIT_URL || "https://fb.makeloops.xyz";
  try {
    await fetch(`${FB_TOOLKIT_URL}/api/engagement-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data, timestamp: new Date().toISOString(), source: "page-engager" }),
    }).catch(() => {}); // fire-and-forget
  } catch {}
}

export default app;
