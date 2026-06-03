import { Router } from "express";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { workoutSessionsTable, sessionLogsTable, exercisesTable, userProfilesTable } from "@workspace/db";

const router = Router();

const XP_PER_EXERCISE = 10;
const COINS_PER_EXERCISE = 2;
const XP_PER_WORKOUT = 50;
const COINS_PER_WORKOUT = 10;
const XP_PER_LEVEL = 100;

async function awardXp(xp: number, coins: number) {
  const [profile] = await db.select().from(userProfilesTable).limit(1);
  if (!profile) return null;

  const newTotalXp = profile.totalXp + xp;
  const newTotalCoins = profile.totalCoins + coins;
  const oldLevel = profile.level;
  const newLevel = Math.floor(newTotalXp / XP_PER_LEVEL) + 1;

  const [updated] = await db.update(userProfilesTable)
    .set({ totalXp: newTotalXp, totalCoins: newTotalCoins, level: newLevel })
    .where(eq(userProfilesTable.id, profile.id))
    .returning();

  return { xpEarned: xp, coinsEarned: coins, totalXp: newTotalXp, totalCoins: newTotalCoins, level: newLevel, leveledUp: newLevel > oldLevel };
}

router.get("/sessions", async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) ?? "50", 10);
  const sessions = await db
    .select({
      id: workoutSessionsTable.id,
      splitType: workoutSessionsTable.splitType,
      splitVariant: workoutSessionsTable.splitVariant,
      scheduledDate: workoutSessionsTable.scheduledDate,
      completedAt: workoutSessionsTable.completedAt,
      isCompleted: workoutSessionsTable.isCompleted,
      photoUri: workoutSessionsTable.photoUri,
      createdAt: workoutSessionsTable.createdAt,
      logCount: count(sessionLogsTable.id),
    })
    .from(workoutSessionsTable)
    .leftJoin(sessionLogsTable, eq(sessionLogsTable.sessionId, workoutSessionsTable.id))
    .groupBy(workoutSessionsTable.id)
    .orderBy(workoutSessionsTable.scheduledDate, workoutSessionsTable.createdAt)
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
  const [session] = await db.insert(workoutSessionsTable).values({
    splitType,
    splitVariant,
    scheduledDate,
    completedAt: completedAt ? new Date(completedAt) : undefined,
  }).returning();
  res.status(201).json({ ...session, logCount: 0 });
});

router.get("/sessions/:sessionId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const sessionId = parseInt(raw, 10);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  const [session] = await db.select().from(workoutSessionsTable).where(eq(workoutSessionsTable.id, sessionId));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const logs = await db
    .select({
      id: sessionLogsTable.id,
      sessionId: sessionLogsTable.sessionId,
      exerciseId: sessionLogsTable.exerciseId,
      sets: sessionLogsTable.sets,
      reps: sessionLogsTable.reps,
      weightUsed: sessionLogsTable.weightUsed,
      notes: sessionLogsTable.notes,
      isCompleted: sessionLogsTable.isCompleted,
      loggedAt: sessionLogsTable.loggedAt,
      exercise: exercisesTable,
    })
    .from(sessionLogsTable)
    .innerJoin(exercisesTable, eq(sessionLogsTable.exerciseId, exercisesTable.id))
    .where(eq(sessionLogsTable.sessionId, sessionId))
    .orderBy(sessionLogsTable.loggedAt);

  let workoutPlan = null;
  if (session.workoutPlanJson) {
    try { workoutPlan = JSON.parse(session.workoutPlanJson); } catch (_) {}
  }

  res.json({ ...session, workoutPlan, logs, logCount: logs.length });
});

router.patch("/sessions/:sessionId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const sessionId = parseInt(raw, 10);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  const { isCompleted, photoUri, completedAt } = req.body as {
    isCompleted?: boolean;
    photoUri?: string;
    completedAt?: string;
  };

  const updates: Record<string, unknown> = {};
  if (isCompleted !== undefined) updates.isCompleted = isCompleted;
  if (photoUri !== undefined) updates.photoUri = photoUri;
  if (completedAt !== undefined) updates.completedAt = new Date(completedAt);

  const [session] = await db.update(workoutSessionsTable).set(updates as any).where(eq(workoutSessionsTable.id, sessionId)).returning();
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const [{ logCount }] = await db.select({ logCount: count() }).from(sessionLogsTable).where(eq(sessionLogsTable.sessionId, sessionId));
  res.json({ ...session, logCount });
});

router.post("/sessions/:sessionId/complete", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const sessionId = parseInt(raw, 10);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  await db.update(workoutSessionsTable)
    .set({ isCompleted: true, completedAt: new Date() })
    .where(eq(workoutSessionsTable.id, sessionId));

  const reward = await awardXp(XP_PER_WORKOUT, COINS_PER_WORKOUT);
  res.json(reward ?? { xpEarned: XP_PER_WORKOUT, coinsEarned: COINS_PER_WORKOUT, totalXp: 0, totalCoins: 0, level: 1, leveledUp: false });
});

router.post("/sessions/:sessionId/logs", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const sessionId = parseInt(raw, 10);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  const { exerciseId, sets, reps, weightUsed, notes, isCompleted } = req.body as {
    exerciseId?: number; sets?: number; reps?: number; weightUsed?: number; notes?: string; isCompleted?: boolean;
  };
  if (!exerciseId || !sets || !reps) { res.status(400).json({ error: "exerciseId, sets, and reps are required" }); return; }

  // Upsert: find existing log for this exercise in this session
  const [existing] = await db.select().from(sessionLogsTable)
    .where(and(eq(sessionLogsTable.sessionId, sessionId), eq(sessionLogsTable.exerciseId, exerciseId)));

  if (existing) {
    const [updated] = await db.update(sessionLogsTable)
      .set({ sets, reps, weightUsed, notes, isCompleted: isCompleted ?? existing.isCompleted })
      .where(eq(sessionLogsTable.id, existing.id))
      .returning();
    res.status(201).json(updated);
  } else {
    const [log] = await db.insert(sessionLogsTable).values({ sessionId, exerciseId, sets, reps, weightUsed, notes, isCompleted: isCompleted ?? false }).returning();
    res.status(201).json(log);
  }
});

router.patch("/sessions/:sessionId/logs/:logId", async (req, res): Promise<void> => {
  const rawSession = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const rawLog = Array.isArray(req.params.logId) ? req.params.logId[0] : req.params.logId;
  const sessionId = parseInt(rawSession, 10);
  const logId = parseInt(rawLog, 10);
  if (isNaN(sessionId) || isNaN(logId)) { res.status(400).json({ error: "Invalid IDs" }); return; }

  const { sets, reps, weightUsed, notes, isCompleted } = req.body as {
    sets?: number; reps?: number; weightUsed?: number; notes?: string; isCompleted?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (sets !== undefined) updates.sets = sets;
  if (reps !== undefined) updates.reps = reps;
  if (weightUsed !== undefined) updates.weightUsed = weightUsed;
  if (notes !== undefined) updates.notes = notes;
  if (isCompleted !== undefined) updates.isCompleted = isCompleted;

  const [log] = await db.update(sessionLogsTable).set(updates as any)
    .where(and(eq(sessionLogsTable.id, logId), eq(sessionLogsTable.sessionId, sessionId)))
    .returning();
  if (!log) { res.status(404).json({ error: "Log not found" }); return; }
  res.json(log);
});

router.post("/sessions/:sessionId/logs/:logId/complete", async (req, res): Promise<void> => {
  const rawSession = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const rawLog = Array.isArray(req.params.logId) ? req.params.logId[0] : req.params.logId;
  const sessionId = parseInt(rawSession, 10);
  const logId = parseInt(rawLog, 10);
  if (isNaN(sessionId) || isNaN(logId)) { res.status(400).json({ error: "Invalid IDs" }); return; }

  await db.update(sessionLogsTable).set({ isCompleted: true })
    .where(and(eq(sessionLogsTable.id, logId), eq(sessionLogsTable.sessionId, sessionId)));

  const reward = await awardXp(XP_PER_EXERCISE, COINS_PER_EXERCISE);
  res.json(reward ?? { xpEarned: XP_PER_EXERCISE, coinsEarned: COINS_PER_EXERCISE, totalXp: 0, totalCoins: 0, level: 1, leveledUp: false });
});

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const [{ total }] = await db.select({ total: count() }).from(workoutSessionsTable);
  const [{ exerciseTotal }] = await db.select({ exerciseTotal: count() }).from(sessionLogsTable);
  const [{ completedTotal }] = await db.select({ completedTotal: count() }).from(workoutSessionsTable).where(eq(workoutSessionsTable.isCompleted, true));

  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const [{ weekCount }] = await db.select({ weekCount: count() }).from(workoutSessionsTable)
    .where(and(
      sql`${workoutSessionsTable.scheduled_date} >= ${weekStartStr}`,
      sql`${workoutSessionsTable.scheduled_date} < ${weekEndStr}`
    ));

  res.json({ totalSessions: total, currentStreak: 0, thisWeekCount: weekCount, totalExercisesLogged: exerciseTotal, completedSessions: completedTotal });
});

export default router;
