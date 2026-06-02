import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workoutSessionsTable = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  splitType: text("split_type").notNull(),
  splitVariant: text("split_variant").notNull().default("Standard"),
  scheduledDate: text("scheduled_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkoutSessionSchema = createInsertSchema(workoutSessionsTable).omit({ id: true, createdAt: true });
export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;
export type WorkoutSession = typeof workoutSessionsTable.$inferSelect;
