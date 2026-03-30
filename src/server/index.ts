import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import targets from "./routes/targets";
import templates from "./routes/templates";
import comments from "./routes/comments";
import sessions from "./routes/sessions";

const app = new Hono();

app.use("*", logger());
app.use("*", cors({ origin: "http://localhost:5173" }));

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Routes
app.route("/api/targets", targets);
app.route("/api/templates", templates);
app.route("/api/comments", comments);
app.route("/api/sessions", sessions);

import { seedTemplates } from "./db/seed";
seedTemplates();

console.log("🚀 Page Engager API running on http://localhost:3000");

import { serve } from "@hono/node-server";

serve({ fetch: app.fetch, port: 3000 });
