import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import targets from "./routes/targets";
import templates from "./routes/templates";
import comments from "./routes/comments";
import sessions from "./routes/sessions";
import activity from "./routes/activity";
import preview from "./routes/preview";
import auto from "./routes/auto";

const app = new Hono();

app.use("*", logger());
app.use("*", cors({ origin: ["http://localhost:5173", "http://localhost:3000"] }));

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Routes
app.route("/api/targets", targets);
app.route("/api/templates", templates);
app.route("/api/comments", comments);
app.route("/api/sessions", sessions);
app.route("/api/activity", activity);
app.route("/api/preview", preview);
app.route("/api/auto", auto);

// Serve built frontend in production
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "fs";
import { join } from "path";

const distPath = join(import.meta.dirname || ".", "..", "..", "dist", "web");
if (existsSync(distPath)) {
  app.use("/*", serveStatic({ root: distPath }));
  // SPA fallback
  app.get("*", (c) => {
    const indexPath = join(distPath, "index.html");
    if (existsSync(indexPath)) {
      return c.html(require("fs").readFileSync(indexPath, "utf-8"));
    }
    return c.notFound();
  });
}

import { seedTemplates } from "./db/seed";
seedTemplates();

console.log("🚀 Page Engager API running on http://localhost:3000");

import { serve } from "@hono/node-server";

serve({ fetch: app.fetch, port: 3000 });
