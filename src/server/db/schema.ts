import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const targets = sqliteTable("targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  pageId: text("page_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
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

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  cookies: text("cookies").notNull(), // JSON string of cookies
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
