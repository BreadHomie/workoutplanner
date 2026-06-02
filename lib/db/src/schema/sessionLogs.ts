import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workoutSessionsTable } from "./workoutSessions";
import { exercisesTable } from "./exercises";

export const sessionLogsTable = pgTable("session_logs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => workoutSessionsTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercisesTable.id),
  sets: integer("sets").notNull(),
  reps: integer("reps").notNull(),
  weightUsed: real("weight_used"),
  notes: text("notes"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionLogSchema = createInsertSchema(sessionLogsTable).omit({ id: true, loggedAt: true });
export type InsertSessionLog = z.infer<typeof insertSessionLogSchema>;
export type SessionLog = typeof sessionLogsTable.$inferSelect;
