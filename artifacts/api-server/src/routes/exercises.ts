import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { exercisesTable, sessionLogsTable } from "@workspace/db";

const router = Router();

router.get("/exercises", async (req, res): Promise<void> => {
  const { difficulty, equipment, muscleGroup, isCompound } = req.query as {
    difficulty?: string;
    equipment?: string;
    muscleGroup?: string;
    isCompound?: string;
  };

  const conditions = [];

  if (difficulty) {
    if (difficulty === "Beginner") conditions.push(inArray(exercisesTable.difficulty, ["Beginner"]));
    else if (difficulty === "Intermediate") conditions.push(inArray(exercisesTable.difficulty, ["Beginner", "Intermediate"]));
    else if (difficulty === "Advanced") conditions.push(inArray(exercisesTable.difficulty, ["Beginner", "Intermediate", "Advanced"]));
  }

  if (equipment) {
    const equipList = equipment.split(",").map((e) => e.trim());
    conditions.push(inArray(exercisesTable.equipment, equipList));
  }

  if (muscleGroup) {
    const mg = muscleGroup.toLowerCase();
    if (mg === "chest") conditions.push(eq(exercisesTable.hitChest, true));
    else if (mg === "back") conditions.push(eq(exercisesTable.hitBack, true));
    else if (mg === "legs") conditions.push(eq(exercisesTable.hitLegs, true));
    else if (mg === "core") conditions.push(eq(exercisesTable.hitCore, true));
    else if (mg === "arm" || mg === "arms") conditions.push(eq(exercisesTable.hitArm, true));
    else if (mg === "shoulder" || mg === "shoulders") conditions.push(eq(exercisesTable.hitShoulder, true));
  }

  if (isCompound !== undefined) {
    conditions.push(eq(exercisesTable.isCompound, isCompound === "true"));
  }

  const exercises = await db
    .select()
    .from(exercisesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(exercisesTable.name);

  res.json(exercises);
});

router.get("/exercises/:id/last-log", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const exerciseId = parseInt(raw, 10);

  if (isNaN(exerciseId)) {
    res.status(400).json({ error: "Invalid exercise ID" });
    return;
  }

  const [log] = await db
    .select()
    .from(sessionLogsTable)
    .where(eq(sessionLogsTable.exerciseId, exerciseId))
    .orderBy(desc(sessionLogsTable.loggedAt))
    .limit(1);

  if (!log) {
    res.status(404).json({ error: "No previous log found" });
    return;
  }

  res.json(log);
});

export default router;
