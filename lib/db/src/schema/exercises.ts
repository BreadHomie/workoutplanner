import { boolean, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exercisesTable = pgTable("exercises", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  equipment: text("equipment").notNull(),
  difficulty: text("difficulty").notNull(),
  isCompound: boolean("is_compound").notNull().default(false),
  hitChest: boolean("hit_chest").notNull().default(false),
  hitBack: boolean("hit_back").notNull().default(false),
  hitLegs: boolean("hit_legs").notNull().default(false),
  hitCore: boolean("hit_core").notNull().default(false),
  hitArm: boolean("hit_arm").notNull().default(false),
  hitShoulder: boolean("hit_shoulder").notNull().default(false),
  classification: text("classification").notNull(),
});

export const insertExerciseSchema = createInsertSchema(exercisesTable).omit({ id: true });
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercisesTable.$inferSelect;
