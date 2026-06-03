import { Router } from "express";
import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { workoutSessionsTable, sessionLogsTable, exercisesTable, userProfilesTable, scheduleTable } from "@workspace/db";
import { getLastLog } from "../lib/workoutGenerator";

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
      rating: sessionLogsTable.rating,
      setCompletions: sessionLogsTable.setCompletions,
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

router.post("/sessions/:sessionId/replace-exercise", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const sessionId = parseInt(raw, 10);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  const { exerciseId, direction } = req.body as { exerciseId: number; direction: "random" | "easier" | "harder" };
  if (!exerciseId || !direction) { res.status(400).json({ error: "exerciseId and direction are required" }); return; }

  const [session] = await db.select().from(workoutSessionsTable).where(eq(workoutSessionsTable.id, sessionId));
  if (!session || !session.workoutPlanJson) { res.status(404).json({ error: "Session not found" }); return; }

  const [currentEx] = await db.select().from(exercisesTable).where(eq(exercisesTable.id, exerciseId));
  if (!currentEx) { res.status(404).json({ error: "Exercise not found" }); return; }

  const [profile] = await db.select().from(userProfilesTable).limit(1);
  const equipment = profile?.equipment ?? [];

  const diffLevels = ["Beginner", "Intermediate", "Advanced"];
  const idx = diffLevels.indexOf(currentEx.difficulty);

  let targetDiffs: string[];
  if (direction === "easier") {
    targetDiffs = idx > 0 ? diffLevels.slice(0, idx) : ["Beginner"];
  } else if (direction === "harder") {
    targetDiffs = idx < 2 ? diffLevels.slice(idx + 1) : ["Advanced"];
  } else {
    targetDiffs = diffLevels.slice(0, idx + 1);
  }

  const muscleConditions: ReturnType<typeof eq>[] = [];
  if (currentEx.hitChest) muscleConditions.push(eq(exercisesTable.hitChest, true));
  if (currentEx.hitBack) muscleConditions.push(eq(exercisesTable.hitBack, true));
  if (currentEx.hitLegs) muscleConditions.push(eq(exercisesTable.hitLegs, true));
  if (currentEx.hitCore) muscleConditions.push(eq(exercisesTable.hitCore, true));
  if (currentEx.hitArm) muscleConditions.push(eq(exercisesTable.hitArm, true));
  if (currentEx.hitShoulder) muscleConditions.push(eq(exercisesTable.hitShoulder, true));
  if (muscleConditions.length === 0) { res.status(400).json({ error: "Cannot determine muscle group" }); return; }

  // Get all exercise IDs already in the plan (to exclude)
  const plan = JSON.parse(session.workoutPlanJson);
  const planIds = new Set<number>();
  if (plan.compound?.exercise?.id) planIds.add(plan.compound.exercise.id);
  if (plan.compound2?.exercise?.id) planIds.add(plan.compound2.exercise.id);
  plan.circuits?.forEach((c: any) => c.exercises?.forEach((e: any) => { if (e.exercise?.id) planIds.add(e.exercise.id); }));
  planIds.delete(exerciseId);

  const buildConditions = (diffs: string[]) => {
    const conds: ReturnType<typeof eq>[] = [
      inArray(exercisesTable.difficulty, diffs) as any,
      (muscleConditions.length === 1 ? muscleConditions[0] : or(...muscleConditions)) as any,
    ];
    if (currentEx.isCompound) conds.push(eq(exercisesTable.isCompound, true) as any);
    if (equipment.length > 0) conds.push(inArray(exercisesTable.equipment, equipment) as any);
    return conds;
  };

  let candidates = await db.select().from(exercisesTable).where(and(...buildConditions(targetDiffs)));
  candidates = candidates.filter(e => !planIds.has(e.id));

  if (candidates.length === 0) {
    // Relax difficulty constraint
    const relaxed = [
      (muscleConditions.length === 1 ? muscleConditions[0] : or(...muscleConditions)) as any,
      ...(equipment.length > 0 ? [inArray(exercisesTable.equipment, equipment) as any] : []),
    ];
    candidates = (await db.select().from(exercisesTable).where(and(...relaxed))).filter(e => !planIds.has(e.id) && e.id !== exerciseId);
  }

  if (candidates.length === 0) { res.status(400).json({ error: "No replacement exercise found" }); return; }

  const newEx = candidates[Math.floor(Math.random() * candidates.length)];
  const lastLog = await getLastLog(newEx.id);

  // Find suggestedSets/Reps for the slot being replaced
  let suggestedSets = 3;
  let suggestedReps = 8;
  if (plan.compound?.exercise?.id === exerciseId) {
    suggestedSets = plan.compound.suggestedSets ?? 4;
    suggestedReps = plan.compound.suggestedReps ?? 8;
    plan.compound = { ...plan.compound, exercise: newEx, lastLog };
  } else if (plan.compound2?.exercise?.id === exerciseId) {
    suggestedSets = plan.compound2.suggestedSets ?? 4;
    suggestedReps = plan.compound2.suggestedReps ?? 8;
    plan.compound2 = { ...plan.compound2, exercise: newEx, lastLog };
  } else {
    plan.circuits?.forEach((c: any) => {
      c.exercises?.forEach((e: any) => {
        if (e.exercise?.id === exerciseId) {
          suggestedSets = e.suggestedSets ?? 3;
          suggestedReps = e.suggestedReps ?? 8;
          e.exercise = newEx;
          e.lastLog = lastLog;
        }
      });
    });
  }

  // Delete old log stub, create new one
  await db.delete(sessionLogsTable)
    .where(and(eq(sessionLogsTable.sessionId, sessionId), eq(sessionLogsTable.exerciseId, exerciseId)));

  await db.insert(sessionLogsTable).values({
    sessionId,
    exerciseId: newEx.id,
    sets: suggestedSets,
    reps: suggestedReps,
    weightUsed: lastLog?.weightUsed ?? undefined,
    isCompleted: false,
  });

  await db.update(workoutSessionsTable)
    .set({ workoutPlanJson: JSON.stringify(plan) })
    .where(eq(workoutSessionsTable.id, sessionId));

  res.json({ exercise: newEx, lastLog });
});

router.post("/sessions/:sessionId/logs", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const sessionId = parseInt(raw, 10);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  const { exerciseId, sets, reps, weightUsed, notes, rating, setCompletions, isCompleted } = req.body as {
    exerciseId?: number; sets?: number; reps?: number; weightUsed?: number; notes?: string;
    rating?: number; setCompletions?: string; isCompleted?: boolean;
  };
  if (!exerciseId || !sets || !reps) { res.status(400).json({ error: "exerciseId, sets, and reps are required" }); return; }

  const [existing] = await db.select().from(sessionLogsTable)
    .where(and(eq(sessionLogsTable.sessionId, sessionId), eq(sessionLogsTable.exerciseId, exerciseId)));

  if (existing) {
    const [updated] = await db.update(sessionLogsTable)
      .set({ sets, reps, weightUsed, notes, rating, setCompletions, isCompleted: isCompleted ?? existing.isCompleted })
      .where(eq(sessionLogsTable.id, existing.id))
      .returning();
    res.status(201).json(updated);
  } else {
    const [log] = await db.insert(sessionLogsTable).values({ sessionId, exerciseId, sets, reps, weightUsed, notes, rating, setCompletions, isCompleted: isCompleted ?? false }).returning();
    res.status(201).json(log);
  }
});

router.patch("/sessions/:sessionId/logs/:logId", async (req, res): Promise<void> => {
  const rawSession = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const rawLog = Array.isArray(req.params.logId) ? req.params.logId[0] : req.params.logId;
  const sessionId = parseInt(rawSession, 10);
  const logId = parseInt(rawLog, 10);
  if (isNaN(sessionId) || isNaN(logId)) { res.status(400).json({ error: "Invalid IDs" }); return; }

  const { sets, reps, weightUsed, notes, rating, setCompletions, isCompleted } = req.body as {
    sets?: number; reps?: number; weightUsed?: number; notes?: string;
    rating?: number; setCompletions?: string; isCompleted?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (sets !== undefined) updates.sets = sets;
  if (reps !== undefined) updates.reps = reps;
  if (weightUsed !== undefined) updates.weightUsed = weightUsed;
  if (notes !== undefined) updates.notes = notes;
  if (rating !== undefined) updates.rating = rating;
  if (setCompletions !== undefined) updates.setCompletions = setCompletions;
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

router.delete("/sessions/reset-workouts", async (_req, res): Promise<void> => {
  const sessions = await db.select({ id: workoutSessionsTable.id }).from(workoutSessionsTable);
  if (sessions.length > 0) {
    await db.delete(workoutSessionsTable);
  }
  res.json({ deleted: sessions.length });
});

router.delete("/sessions/reset-all", async (_req, res): Promise<void> => {
  const sessions = await db.select({ id: workoutSessionsTable.id }).from(workoutSessionsTable);
  await db.delete(workoutSessionsTable);
  await db.delete(scheduleTable);
  await db.update(userProfilesTable).set({
    totalXp: 0, totalCoins: 0, level: 1,
    difficultyLevel: "Intermediate",
    equipment: ["Bodyweight", "Dumbbells", "Barbell", "Cables"],
    targetCadence: 3,
    preferredSplit: "Full Body",
  });
  res.json({ deleted: sessions.length });
});

router.get("/stats/personal-records", async (_req, res): Promise<void> => {
  const records = await db
    .select({
      exerciseId: exercisesTable.id,
      exerciseName: exercisesTable.name,
      hitChest: exercisesTable.hitChest,
      hitBack: exercisesTable.hitBack,
      hitLegs: exercisesTable.hitLegs,
      hitCore: exercisesTable.hitCore,
      hitArm: exercisesTable.hitArm,
      hitShoulder: exercisesTable.hitShoulder,
      bestWeight: sql<number>`MAX(${sessionLogsTable.weightUsed})`,
      reps: sql<number>`(array_agg(${sessionLogsTable.reps} ORDER BY ${sessionLogsTable.weightUsed} DESC))[1]`,
      achievedAt: sql<string>`MAX(${sessionLogsTable.loggedAt})`,
    })
    .from(sessionLogsTable)
    .innerJoin(exercisesTable, eq(sessionLogsTable.exerciseId, exercisesTable.id))
    .where(sql`${sessionLogsTable.weightUsed} IS NOT NULL AND ${sessionLogsTable.weightUsed} > 0`)
    .groupBy(
      exercisesTable.id,
      exercisesTable.name,
      exercisesTable.hitChest,
      exercisesTable.hitBack,
      exercisesTable.hitLegs,
      exercisesTable.hitCore,
      exercisesTable.hitArm,
      exercisesTable.hitShoulder,
    )
    .orderBy(exercisesTable.name);

  const result = records.map((r) => {
    let muscleGroup = "Other";
    if (r.hitChest) muscleGroup = "Chest";
    else if (r.hitBack) muscleGroup = "Back";
    else if (r.hitLegs) muscleGroup = "Legs";
    else if (r.hitCore) muscleGroup = "Core";
    else if (r.hitArm) muscleGroup = "Arms";
    else if (r.hitShoulder) muscleGroup = "Shoulders";
    return { exerciseId: r.exerciseId, exerciseName: r.exerciseName, muscleGroup, bestWeight: r.bestWeight, reps: r.reps, achievedAt: r.achievedAt };
  });

  res.json(result);
});

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const [{ total }] = await db.select({ total: count() }).from(workoutSessionsTable);
  const [{ exerciseTotal }] = await db.select({ exerciseTotal: count() }).from(sessionLogsTable);
  const [{ completedTotal }] = await db.select({ completedTotal: count() }).from(workoutSessionsTable).where(eq(workoutSessionsTable.isCompleted, true));

  // Simple streak: consecutive days with a completed session going back from today
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(workoutSessionsTable)
      .where(and(eq(workoutSessionsTable.scheduledDate, dateStr), eq(workoutSessionsTable.isCompleted, true)));
    if (cnt > 0) streak++;
    else if (i > 0) break;
  }

  const weekStart = new Date(today);
  const dayOfWeek = today.getDay();
  weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const weekSessions = await db
    .select()
    .from(workoutSessionsTable)
    .where(
      and(
        sql`${workoutSessionsTable.scheduledDate} >= ${weekStartStr}`,
        sql`${workoutSessionsTable.scheduledDate} < ${weekEndStr}`
      )
    );

  res.json({
    totalSessions: total,
    currentStreak: streak,
    thisWeekCount: weekSessions.length,
    totalExercisesLogged: exerciseTotal,
    completedSessions: completedTotal,
  });
});

export default router;
