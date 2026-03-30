import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const targets = sqliteTable("targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  pageId: text("page_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  interactionCount: integer("interaction_count").notNull().default(0),
  lastSeen: text("last_seen"),
  source: text("source").default("manual"), // manual, discover
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  category: text("category").default("general"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetId: integer("target_id").references(() => targets.id),
  templateId: integer("template_id").references(() => templates.id),
  postUrl: text("post_url").notNull(),
  postText: text("post_text"),
  commentText: text("comment_text").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, failed
  sentAt: text("sent_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const scanCache = sqliteTable("scan_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetId: integer("target_id").references(() => targets.id),
  posts: text("posts").notNull().default("[]"),
  scannedAt: text("scanned_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  profileDir: text("profile_dir").notNull().default(""), // Chrome profile dir e.g. "Profile 8"
  cookies: text("cookies").notNull().default("[]"), // legacy — kept for backwards compat
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
