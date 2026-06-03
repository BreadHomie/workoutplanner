import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { workoutSessionsTable, sessionLogsTable } from "@workspace/db";
import { generateWorkout, getPlanDates, SPLIT_CYCLES } from "../lib/workoutGenerator";

const router = Router();

router.post("/workouts/generate", async (req, res): Promise<void> => {
  const { period, count, startDate, difficultyLevel, equipment, preferredSplit, targetCadence } = req.body as {
    period?: string;
    count?: number;
    startDate?: string;
    difficultyLevel?: string;
    equipment?: string[];
    preferredSplit?: string;
    targetCadence?: number;
  };

  if (!period || !startDate || !difficultyLevel || !equipment || !preferredSplit || !targetCadence) {
    res.status(400).json({ error: "period, startDate, difficultyLevel, equipment, preferredSplit, and targetCadence are required" });
    return;
  }

  const planCount = Math.max(1, count ?? 1);
  const cycle = SPLIT_CYCLES[preferredSplit] ?? SPLIT_CYCLES["Full Body"];
  const allDates = getPlanDates(period as "daily" | "weekly" | "monthly", startDate, targetCadence, planCount);

  // Preserve completed sessions — skip dates that already have a completed session
  const existingForDates = await db.select()
    .from(workoutSessionsTable)
    .where(inArray(workoutSessionsTable.scheduledDate, allDates));

  const completedDates = new Set(
    existingForDates.filter(s => s.isCompleted).map(s => s.scheduledDate).filter(Boolean) as string[]
  );
  const uncompletedIds = existingForDates.filter(s => !s.isCompleted).map(s => s.id);

  // Delete uncompleted sessions (cascade removes their logs)
  if (uncompletedIds.length > 0) {
    await db.delete(workoutSessionsTable).where(inArray(workoutSessionsTable.id, uncompletedIds));
  }

  const datesToGenerate = allDates.filter(d => !completedDates.has(d));

  const results = [];
  const sessionUsedIds = new Set<number>();

  for (let i = 0; i < datesToGenerate.length; i++) {
    const [splitType, splitVariant] = cycle[i % cycle.length];
    const scheduledDate = datesToGenerate[i];

    const workout = await generateWorkout({
      splitType,
      splitVariant,
      difficultyLevel,
      equipment,
      scheduledDate,
      sessionUsedIds,
    });

    const [session] = await db.insert(workoutSessionsTable).values({
      splitType,
      splitVariant,
      scheduledDate,
      workoutPlanJson: JSON.stringify(workout),
    }).returning();

    const allExercises = [];
    if (workout.compound) allExercises.push(workout.compound);
    if (workout.compound2) allExercises.push(workout.compound2);
    workout.circuits.forEach(c => c.exercises.forEach(ex => allExercises.push(ex)));

    for (const item of allExercises) {
      if (item.exercise) {
        await db.insert(sessionLogsTable).values({
          sessionId: session.id,
          exerciseId: item.exercise.id,
          sets: item.suggestedSets,
          reps: item.suggestedReps,
          weightUsed: item.lastLog?.weightUsed ?? undefined,
          isCompleted: false,
        });
      }
    }

    const logs = await db.select().from(sessionLogsTable).where(eq(sessionLogsTable.sessionId, session.id));

    results.push({
      ...session,
      workoutPlan: workout,
      logs,
      logCount: logs.length,
    });
  }

  res.json(results);
});

export default router;
