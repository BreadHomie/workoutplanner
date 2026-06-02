import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workoutSessionsTable } from "./workoutSessions";

export const scheduleTable = pgTable("schedule", {
  id: serial("id").primaryKey(),
  scheduledDate: text("scheduled_date").notNull(),
  splitType: text("split_type").notNull(),
  splitVariant: text("split_variant").notNull().default("Standard"),
  sessionId: integer("session_id").references(() => workoutSessionsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScheduleSchema = createInsertSchema(scheduleTable).omit({ id: true, createdAt: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof scheduleTable.$inferSelect;
