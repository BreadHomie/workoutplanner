import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { exercisesTable, sessionLogsTable, workoutSessionsTable } from "@workspace/db";
import type { Exercise } from "@workspace/db";

export type MuscleGroup = "chest" | "back" | "legs" | "core" | "arm" | "shoulder";

type SlotFilter = { muscles: MuscleGroup[]; isCompound?: boolean };
type CircuitLayout = { slots: SlotFilter[] };
type SplitLayout = { compound: SlotFilter; compound2?: SlotFilter; circuits: CircuitLayout[] };

const SPLIT_LAYOUTS: Record<string, SplitLayout> = {
  "Full Body": {
    compound: { muscles: ["chest", "back", "legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["chest"] }, { muscles: ["back"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
      { slots: [{ muscles: ["arm"] }, { muscles: ["shoulder"] }] },
    ],
  },
  "Upper": {
    compound: { muscles: ["chest", "back"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["chest"] }, { muscles: ["back"] }] },
      { slots: [{ muscles: ["chest"] }, { muscles: ["arm"] }] },
      { slots: [{ muscles: ["back"] }, { muscles: ["arm"] }] },
    ],
  },
  "Upper_Core": {
    compound: { muscles: ["chest", "back"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["chest"] }, { muscles: ["back"] }] },
      { slots: [{ muscles: ["chest"] }, { muscles: ["arm"] }] },
      { slots: [{ muscles: ["back"] }, { muscles: ["arm"] }] },
    ],
  },
  "Lower": {
    compound: { muscles: ["legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
    ],
  },
  "Lower_Core": {
    compound: { muscles: ["legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
    ],
  },
  "Push": {
    compound: { muscles: ["chest", "shoulder"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["chest"] }, { muscles: ["arm"] }] },
      { slots: [{ muscles: ["chest"] }, { muscles: ["shoulder"] }] },
      { slots: [{ muscles: ["shoulder"] }, { muscles: ["arm"] }] },
    ],
  },
  "Pull": {
    compound: { muscles: ["back"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["back"] }, { muscles: ["arm"] }] },
      { slots: [{ muscles: ["back"] }, { muscles: ["back"] }] },
      { slots: [{ muscles: ["back"] }, { muscles: ["arm"] }] },
    ],
  },
  "Legs": {
    compound: { muscles: ["legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
    ],
  },
  "Legs_Core": {
    compound: { muscles: ["legs"], isCompound: true },
    compound2: { muscles: ["legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
    ],
  },
};

// Split cycles for each preferred program
export const SPLIT_CYCLES: Record<string, Array<[string, string]>> = {
  "Full Body": [["Full Body", "Standard"]],
  "Upper/Lower": [["Upper", "Standard"], ["Lower", "Standard"]],
  "Upper/Lower + Core": [["Upper", "Standard"], ["Lower", "Core"]],
  "Push/Pull/Legs": [["Push", "Standard"], ["Pull", "Standard"], ["Legs", "Standard"]],
  "Push/Pull/Legs + Core": [["Push", "Standard"], ["Pull", "Standard"], ["Legs", "Core"]],
};

function muscleFilter(muscles: MuscleGroup[]) {
  const conditions = muscles.map((m) => {
    switch (m) {
      case "chest": return eq(exercisesTable.hitChest, true);
      case "back": return eq(exercisesTable.hitBack, true);
      case "legs": return eq(exercisesTable.hitLegs, true);
      case "core": return eq(exercisesTable.hitCore, true);
      case "arm": return eq(exercisesTable.hitArm, true);
      case "shoulder": return eq(exercisesTable.hitShoulder, true);
    }
  });
  return conditions.length === 1 ? conditions[0] : or(...conditions);
}

function difficultyFilter(level: string) {
  if (level === "Beginner") return inArray(exercisesTable.difficulty, ["Beginner"]);
  if (level === "Intermediate") return inArray(exercisesTable.difficulty, ["Beginner", "Intermediate"]);
  return inArray(exercisesTable.difficulty, ["Beginner", "Intermediate", "Advanced"]);
}

function equipmentFilter(equipment: string[]) {
  if (!equipment || equipment.length === 0) return undefined;
  return inArray(exercisesTable.equipment, equipment);
}

function pickRandom(pool: Exercise[], usedIds: Set<number>): Exercise | undefined {
  const available = pool.filter((e) => !usedIds.has(e.id));
  if (available.length === 0) return undefined;
  const pick = available[Math.floor(Math.random() * available.length)];
  usedIds.add(pick.id);
  return pick;
}

async function getWeeklyUsedExerciseIds(weekStart: string): Promise<number[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];
  const logs = await db
    .select({ exerciseId: sessionLogsTable.exerciseId })
    .from(sessionLogsTable)
    .innerJoin(workoutSessionsTable, eq(sessionLogsTable.sessionId, workoutSessionsTable.id))
    .where(
      and(
        sql`${workoutSessionsTable.scheduledDate} >= ${weekStart}`,
        sql`${workoutSessionsTable.scheduledDate} < ${weekEndStr}`
      )
    );
  return [...new Set(logs.map((l) => l.exerciseId))];
}

export async function getLastLog(exerciseId: number) {
  const [log] = await db
    .select()
    .from(sessionLogsTable)
    .where(eq(sessionLogsTable.exerciseId, exerciseId))
    .orderBy(desc(sessionLogsTable.loggedAt))
    .limit(1);
  return log ?? null;
}

export async function generateWorkout(params: {
  splitType: string;
  splitVariant: string;
  difficultyLevel: string;
  equipment: string[];
  scheduledDate?: string;
  sessionUsedIds?: Set<number>;
}) {
  const { splitType, splitVariant, difficultyLevel, equipment, scheduledDate, sessionUsedIds } = params;

  const isCore = splitVariant === "Core";
  let layoutKey = splitType;
  if (isCore && ["Lower", "Legs"].includes(splitType)) layoutKey = `${splitType}_Core`;
  else if (isCore && splitType === "Upper") layoutKey = "Upper_Core";

  const layout = SPLIT_LAYOUTS[layoutKey] ?? SPLIT_LAYOUTS[splitType];
  if (!layout) throw new Error(`Unknown split: ${splitType}`);

  const today = scheduledDate ? new Date(scheduledDate) : new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const weeklyUsed = await getWeeklyUsedExerciseIds(weekStartStr);
  const usedIds = sessionUsedIds ?? new Set<number>(weeklyUsed);
  weeklyUsed.forEach(id => usedIds.add(id));

  const diffCond = difficultyFilter(difficultyLevel);
  const equipCond = equipmentFilter(equipment);

  async function getPool(slot: SlotFilter) {
    const conditions = [diffCond, muscleFilter(slot.muscles)];
    if (equipCond) conditions.push(equipCond);
    if (slot.isCompound) conditions.push(eq(exercisesTable.isCompound, true));
    return db.select().from(exercisesTable).where(and(...conditions));
  }

  const compoundPool = await getPool(layout.compound);
  const compoundEx = pickRandom(compoundPool, usedIds);

  let compound2Ex: Exercise | undefined;
  if (layout.compound2) {
    const pool2 = await getPool(layout.compound2);
    compound2Ex = pickRandom(pool2, usedIds);
  }

  const circuits: { circuitNumber: number; exercises: { exercise: Exercise; lastLog: Awaited<ReturnType<typeof getLastLog>>; suggestedSets: number; suggestedReps: number }[] }[] = [];

  for (let i = 0; i < layout.circuits.length; i++) {
    const circuit = layout.circuits[i];
    const circuitExercises = [];
    for (const slot of circuit.slots) {
      const pool = await getPool(slot);
      const ex = pickRandom(pool, usedIds);
      if (ex) {
        const lastLog = await getLastLog(ex.id);
        circuitExercises.push({ exercise: ex, lastLog, suggestedSets: 3, suggestedReps: 8 });
      }
    }
    circuits.push({ circuitNumber: i + 1, exercises: circuitExercises });
  }

  const compoundLastLog = compoundEx ? await getLastLog(compoundEx.id) : null;
  const result: {
    splitType: string;
    splitVariant: string;
    compound: { exercise: Exercise; lastLog: typeof compoundLastLog; suggestedSets: number; suggestedReps: number };
    compound2?: { exercise: Exercise; lastLog: Awaited<ReturnType<typeof getLastLog>>; suggestedSets: number; suggestedReps: number };
    circuits: typeof circuits;
    scheduledDate?: string;
  } = {
    splitType,
    splitVariant,
    compound: { exercise: compoundEx!, lastLog: compoundLastLog, suggestedSets: 4, suggestedReps: 8 },
    circuits,
    scheduledDate,
  };

  if (compound2Ex) {
    const c2LastLog = await getLastLog(compound2Ex.id);
    result.compound2 = { exercise: compound2Ex, lastLog: c2LastLog, suggestedSets: 4, suggestedReps: 8 };
  }

  return result;
}

// Generate dates spread across a period
export function getPlanDates(period: "daily" | "weekly" | "monthly", startDate: string, cadence: number): string[] {
  const start = new Date(startDate);
  if (period === "daily") return [startDate];

  const totalDays = period === "weekly" ? 7 : 30;
  const count = period === "weekly" ? cadence : cadence * 4;
  const dates: string[] = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    const offset = Math.floor((i * totalDays) / count);
    d.setDate(start.getDate() + offset);
    dates.push(d.toISOString().split("T")[0]);
  }

  return dates;
}
