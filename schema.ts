import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const feedbackEntries = mysqlTable("feedbackEntries", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 36 }).notNull().unique(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  rating: mysqlEnum("rating", ["up", "down"]).notNull(),
  comment: text("comment").notNull(),
  sentiment: mysqlEnum("sentiment", ["positive", "neutral", "negative"]).default("neutral").notNull(),
  sentimentSource: mysqlEnum("sentimentSource", ["ai", "fallback"]).default("fallback").notNull(),
  issueCategory: mysqlEnum("issueCategory", ["none", "inaccurate", "missing_detail", "unclear", "outdated", "other"]).default("none").notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["new", "investigating", "resolved"]).default("new").notNull(),
  reviewerNote: text("reviewerNote").notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  submittedByUserId: int("submittedByUserId"),
  reviewedByUserId: int("reviewedByUserId"),
  alertedAt: timestamp("alertedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("feedback_created_idx").on(table.createdAt),
  index("feedback_rating_status_idx").on(table.rating, table.reviewStatus),
  index("feedback_submitter_idx").on(table.submittedByUserId),
]);

export type FeedbackEntry = typeof feedbackEntries.$inferSelect;
export type InsertFeedbackEntry = typeof feedbackEntries.$inferInsert;
