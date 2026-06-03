import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { workoutSessionsTable, sessionLogsTable } from "@workspace/db";
import { generateWorkout, getPlanDates, SPLIT_CYCLES } from "../lib/workoutGenerator";

const router = Router();

router.post("/workouts/generate", async (req, res): Promise<void> => {
  const { period, startDate, difficultyLevel, equipment, preferredSplit, targetCadence } = req.body as {
    period?: string;
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

  const cycle = SPLIT_CYCLES[preferredSplit] ?? SPLIT_CYCLES["Full Body"];
  const dates = getPlanDates(period as "daily" | "weekly" | "monthly", startDate, targetCadence);

  const results = [];
  const sessionUsedIds = new Set<number>();

  for (let i = 0; i < dates.length; i++) {
    const [splitType, splitVariant] = cycle[i % cycle.length];
    const scheduledDate = dates[i];

    const workout = await generateWorkout({
      splitType,
      splitVariant,
      difficultyLevel,
      equipment,
      scheduledDate,
      sessionUsedIds,
    });

    // Create session in DB and store workout plan
    const [session] = await db.insert(workoutSessionsTable).values({
      splitType,
      splitVariant,
      scheduledDate,
      workoutPlanJson: JSON.stringify(workout),
    }).returning();

    // Build all exercises from the plan for the session logs entries
    const allExercises = [];
    if (workout.compound) allExercises.push(workout.compound);
    if (workout.compound2) allExercises.push(workout.compound2);
    workout.circuits.forEach(c => c.exercises.forEach(ex => allExercises.push(ex)));

    // Pre-create log stubs so user can fill them in
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

    // Reload logs
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
