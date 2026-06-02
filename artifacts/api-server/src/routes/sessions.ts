import { Router } from "express";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { workoutSessionsTable, sessionLogsTable, exercisesTable } from "@workspace/db";

const router = Router();

router.get("/sessions", async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) ?? "20", 10);

  const sessions = await db
    .select({
      id: workoutSessionsTable.id,
      splitType: workoutSessionsTable.splitType,
      splitVariant: workoutSessionsTable.splitVariant,
      scheduledDate: workoutSessionsTable.scheduledDate,
      completedAt: workoutSessionsTable.completedAt,
      createdAt: workoutSessionsTable.createdAt,
      logCount: count(sessionLogsTable.id),
    })
    .from(workoutSessionsTable)
    .leftJoin(sessionLogsTable, eq(sessionLogsTable.sessionId, workoutSessionsTable.id))
    .groupBy(workoutSessionsTable.id)
    .orderBy(desc(workoutSessionsTable.createdAt))
    .limit(limit);

  res.json(sessions);
});

router.post("/sessions", async (req, res): Promise<void> => {
  const { splitType, splitVariant, scheduledDate, completedAt } = req.body as {
    splitType?: string;
    splitVariant?: string;
    scheduledDate?: string;
    completedAt?: string;
  };

  if (!splitType || !splitVariant) {
    res.status(400).json({ error: "splitType and splitVariant are required" });
    return;
  }

  const [session] = await db
    .insert(workoutSessionsTable)
    .values({
      splitType,
      splitVariant,
      scheduledDate,
      completedAt: completedAt ? new Date(completedAt) : undefined,
    })
    .returning();

  res.status(201).json({ ...session, logCount: 0 });
});

router.get("/sessions/:sessionId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const sessionId = parseInt(raw, 10);

  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const [session] = await db
    .select()
    .from(workoutSessionsTable)
    .where(eq(workoutSessionsTable.id, sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const logs = await db
    .select({
      id: sessionLogsTable.id,
      sessionId: sessionLogsTable.sessionId,
      exerciseId: sessionLogsTable.exerciseId,
      sets: sessionLogsTable.sets,
      reps: sessionLogsTable.reps,
      weightUsed: sessionLogsTable.weightUsed,
      notes: sessionLogsTable.notes,
      loggedAt: sessionLogsTable.loggedAt,
      exercise: exercisesTable,
    })
    .from(sessionLogsTable)
    .innerJoin(exercisesTable, eq(sessionLogsTable.exerciseId, exercisesTable.id))
    .where(eq(sessionLogsTable.sessionId, sessionId))
    .orderBy(sessionLogsTable.loggedAt);

  res.json({ ...session, logs });
});

router.post("/sessions/:sessionId/logs", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const sessionId = parseInt(raw, 10);

  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const { exerciseId, sets, reps, weightUsed, notes } = req.body as {
    exerciseId?: number;
    sets?: number;
    reps?: number;
    weightUsed?: number;
    notes?: string;
  };

  if (!exerciseId || !sets || !reps) {
    res.status(400).json({ error: "exerciseId, sets, and reps are required" });
    return;
  }

  const [log] = await db
    .insert(sessionLogsTable)
    .values({ sessionId, exerciseId, sets, reps, weightUsed, notes })
    .returning();

  res.status(201).json(log);
});

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const [{ total }] = await db
    .select({ total: count() })
    .from(workoutSessionsTable);

  const [{ exerciseTotal }] = await db
    .select({ exerciseTotal: count() })
    .from(sessionLogsTable);

  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const [{ weekCount }] = await db
    .select({ weekCount: count() })
    .from(workoutSessionsTable)
    .where(
      and(
        sql`${workoutSessionsTable.scheduledDate} >= ${weekStartStr}`,
        sql`${workoutSessionsTable.scheduledDate} < ${weekEndStr}`
      )
    );

  res.json({
    totalSessions: total,
    currentStreak: 0,
    thisWeekCount: weekCount,
    totalExercisesLogged: exerciseTotal,
  });
});

export default router;
