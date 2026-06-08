import { db } from "../db/index";
import type { Exercise, ExerciseWithHistory, Circuit, WorkoutPlan, SessionLog } from "./types";

type MuscleGroup = "chest" | "back" | "legs" | "core" | "arm" | "shoulder";
type SlotFilter = { muscles: MuscleGroup[]; isCompound?: boolean };
type SplitLayout = {
  compound: SlotFilter;
  compound2?: SlotFilter;
  circuits: { slots: SlotFilter[] }[];
};

const SPLIT_LAYOUTS: Record<string, SplitLayout> = {
  "Full Body": {
    compound: { muscles: ["chest", "back", "legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["chest"] }, { muscles: ["back"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
      { slots: [{ muscles: ["arm"] }, { muscles: ["shoulder"] }] },
    ],
  },
  Upper: {
    compound: { muscles: ["chest", "back"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["chest"] }, { muscles: ["back"] }] },
      { slots: [{ muscles: ["chest"] }, { muscles: ["arm"] }] },
      { slots: [{ muscles: ["back"] }, { muscles: ["arm"] }] },
    ],
  },
  Upper_Core: {
    compound: { muscles: ["chest", "back"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["chest"] }, { muscles: ["back"] }] },
      { slots: [{ muscles: ["chest"] }, { muscles: ["arm"] }] },
      { slots: [{ muscles: ["back"] }, { muscles: ["core"] }] },
    ],
  },
  Lower: {
    compound: { muscles: ["legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
    ],
  },
  Lower_Core: {
    compound: { muscles: ["legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
    ],
  },
  Push: {
    compound: { muscles: ["chest", "shoulder"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["chest"] }, { muscles: ["arm"] }] },
      { slots: [{ muscles: ["chest"] }, { muscles: ["shoulder"] }] },
      { slots: [{ muscles: ["shoulder"] }, { muscles: ["arm"] }] },
    ],
  },
  Pull: {
    compound: { muscles: ["back"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["back"] }, { muscles: ["arm"] }] },
      { slots: [{ muscles: ["back"] }, { muscles: ["back"] }] },
      { slots: [{ muscles: ["back"] }, { muscles: ["arm"] }] },
    ],
  },
  Legs: {
    compound: { muscles: ["legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
    ],
  },
  Legs_Core: {
    compound: { muscles: ["legs"], isCompound: true },
    compound2: { muscles: ["legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
    ],
  },
};

export const SPLIT_CYCLES: Record<string, Array<[string, string]>> = {
  "Full Body": [["Full Body", "Standard"]],
  "Upper/Lower": [
    ["Upper", "Standard"],
    ["Lower", "Standard"],
  ],
  "Upper/Lower + Core": [
    ["Upper", "Standard"],
    ["Lower", "Core"],
  ],
  "Push/Pull/Legs": [
    ["Push", "Standard"],
    ["Pull", "Standard"],
    ["Legs", "Standard"],
  ],
  "Push/Pull/Legs + Core": [
    ["Push", "Standard"],
    ["Pull", "Standard"],
    ["Legs", "Core"],
  ],
};

export async function getLastLog(exerciseId: number): Promise<SessionLog | null> {
  const logs = await db.sessionLogs.where("exerciseId").equals(exerciseId).toArray();
  if (logs.length === 0) return null;
  return logs.sort(
    (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
  )[0];
}

async function getWeeklyUsedExerciseIds(weekStart: string): Promise<number[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const sessions = await db.workoutSessions.toArray();
  const weekSessions = sessions.filter(
    (s) =>
      s.scheduledDate &&
      s.scheduledDate >= weekStart &&
      s.scheduledDate < weekEndStr
  );
  if (weekSessions.length === 0) return [];

  const sessionIds = weekSessions.map((s) => s.id!).filter(Boolean);
  const logs = await db.sessionLogs.where("sessionId").anyOf(sessionIds).toArray();
  return [...new Set(logs.map((l) => l.exerciseId))];
}

function filterBySlot(
  exercises: Exercise[],
  slot: SlotFilter,
  difficulty: string,
  equipment: string[]
): Exercise[] {
  const diffLevels =
    difficulty === "Beginner"
      ? ["Beginner"]
      : difficulty === "Intermediate"
      ? ["Beginner", "Intermediate"]
      : ["Beginner", "Intermediate", "Advanced"];

  const equipSet =
    equipment.length > 0
      ? new Set([...equipment, "Bodyweight"])
      : null;

  return exercises.filter((ex) => {
    if (!diffLevels.includes(ex.difficulty)) return false;
    if (equipSet && !equipSet.has(ex.equipment)) return false;

    const muscleMatch = slot.muscles.some((m) => {
      switch (m) {
        case "chest": return ex.hitChest;
        case "back": return ex.hitBack;
        case "legs": return ex.hitLegs;
        case "core": return ex.hitCore;
        case "arm": return ex.hitArm;
        case "shoulder": return ex.hitShoulder;
      }
    });
    if (!muscleMatch) return false;
    if (slot.isCompound && !ex.isCompound) return false;
    return true;
  });
}

function pickRandom(
  pool: Exercise[],
  sessionUsed: Set<number>,
  weeklyUsed: Set<number>
): Exercise | undefined {
  if (pool.length === 0) return undefined;
  let available = pool.filter((e) => !sessionUsed.has(e.id) && !weeklyUsed.has(e.id));
  if (available.length === 0) available = pool.filter((e) => !sessionUsed.has(e.id));
  if (available.length === 0) available = [...pool];
  const pick = available[Math.floor(Math.random() * available.length)];
  sessionUsed.add(pick.id);
  weeklyUsed.add(pick.id);
  return pick;
}

export async function generateWorkout(params: {
  splitType: string;
  splitVariant: string;
  difficultyLevel: string;
  equipment: string[];
  scheduledDate?: string;
}): Promise<WorkoutPlan> {
  const { splitType, splitVariant, difficultyLevel, equipment, scheduledDate } = params;

  const isCore = splitVariant === "Core";
  let layoutKey = splitType;
  if (isCore && ["Lower", "Legs"].includes(splitType)) layoutKey = `${splitType}_Core`;
  else if (isCore && splitType === "Upper") layoutKey = "Upper_Core";

  const layout = SPLIT_LAYOUTS[layoutKey] ?? SPLIT_LAYOUTS[splitType];
  if (!layout) throw new Error(`Unknown split: ${splitType}`);

  const today = scheduledDate ? new Date(scheduledDate + "T12:00:00") : new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const weeklyUsedArr = await getWeeklyUsedExerciseIds(weekStartStr);
  const weeklyUsed = new Set<number>(weeklyUsedArr);
  const sessionUsed = new Set<number>();

  const allExercises = await db.exercises.toArray();

  function getPool(slot: SlotFilter, relaxEquipment = false): Exercise[] {
    const eq = relaxEquipment ? [] : equipment;
    let pool = filterBySlot(allExercises, slot, difficultyLevel, eq);
    if (pool.length === 0 && !relaxEquipment) {
      pool = filterBySlot(allExercises, slot, difficultyLevel, []);
    }
    return pool;
  }

  async function pickForSlot(slot: SlotFilter): Promise<ExerciseWithHistory | undefined> {
    let pool = getPool(slot);
    let ex = pickRandom(pool, sessionUsed, weeklyUsed);
    if (!ex) {
      pool = getPool(slot, true);
      ex = pickRandom(pool, sessionUsed, weeklyUsed);
    }
    if (!ex) return undefined;
    const lastLog = await getLastLog(ex.id);
    return { exercise: ex, lastLog, suggestedSets: 3, suggestedReps: 8 };
  }

  const compoundItem = await pickForSlot(layout.compound);
  if (!compoundItem) throw new Error("No compound exercise found");
  compoundItem.suggestedSets = 4;

  let compound2: ExerciseWithHistory | undefined;
  if (layout.compound2) {
    const c2 = await pickForSlot(layout.compound2);
    if (c2) { c2.suggestedSets = 4; compound2 = c2; }
  }

  const circuits: Circuit[] = [];
  for (let i = 0; i < layout.circuits.length; i++) {
    const circuitDef = layout.circuits[i];
    const exercises: ExerciseWithHistory[] = [];
    for (const slot of circuitDef.slots) {
      const item = await pickForSlot(slot);
      if (item) exercises.push(item);
    }
    while (exercises.length < circuitDef.slots.length) {
      const fallbackPool = getPool(circuitDef.slots[0], true);
      const ex = pickRandom(fallbackPool, sessionUsed, weeklyUsed);
      if (ex) {
        const lastLog = await getLastLog(ex.id);
        exercises.push({ exercise: ex, lastLog, suggestedSets: 3, suggestedReps: 8 });
      } else break;
    }
    circuits.push({ circuitNumber: i + 1, exercises });
  }

  return {
    splitType,
    splitVariant,
    compound: compoundItem,
    compound2,
    circuits,
    scheduledDate,
  };
}
