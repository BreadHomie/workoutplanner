import { and, avg, desc, eq, inArray, or, sql } from "drizzle-orm";
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
      { slots: [{ muscles: ["back"] }, { muscles: ["core"] }] },
    ],
  },
  "Lower": {
    compound: { muscles: ["legs"], isCompound: true },
    circuits: [
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["legs"] }] },
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
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
      { slots: [{ muscles: ["legs"] }, { muscles: ["core"] }] },
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

/**
 * Build equipment filter. Bodyweight exercises are always included (require no equipment).
 * If equipment list is empty, no equipment restriction is applied.
 */
function equipmentFilter(equipment: string[]) {
  if (!equipment || equipment.length === 0) return undefined;
  const withBodyweight = Array.from(new Set([...equipment, "Bodyweight"]));
  return inArray(exercisesTable.equipment, withBodyweight);
}

async function getExerciseRatings(): Promise<Map<number, number>> {
  const ratings = await db
    .select({
      exerciseId: sessionLogsTable.exerciseId,
      avgRating: avg(sessionLogsTable.rating),
    })
    .from(sessionLogsTable)
    .where(sql`${sessionLogsTable.rating} IS NOT NULL`)
    .groupBy(sessionLogsTable.exerciseId);

  return new Map(ratings.map(r => [r.exerciseId, parseFloat(r.avgRating ?? "3")]));
}

/**
 * Pick a random exercise from the pool, respecting weekly non-repetition with graceful fallback.
 * Tiers:
 *   1. Not in sessionUsed AND not in weeklyUsed
 *   2. Not in sessionUsed (ignore weekly)
 *   3. Anything in pool (last resort)
 */
function pickRandom(
  pool: Exercise[],
  sessionUsed: Set<number>,
  weeklyUsed: Set<number>,
  ratings?: Map<number, number>
): Exercise | undefined {
  if (pool.length === 0) return undefined;

  // Tier 1: prefer exercises unused both in session and week
  let available = pool.filter(e => !sessionUsed.has(e.id) && !weeklyUsed.has(e.id));
  // Tier 2: at least unused in current session
  if (available.length === 0) available = pool.filter(e => !sessionUsed.has(e.id));
  // Tier 3: anything in pool
  if (available.length === 0) available = [...pool];

  if (ratings && ratings.size > 0) {
    const liked = available.filter(e => (ratings.get(e.id) ?? 3) > 1);
    if (liked.length > 0) available = liked;

    const weighted: Exercise[] = [];
    for (const ex of available) {
      weighted.push(ex);
      if ((ratings.get(ex.id) ?? 3) >= 4) weighted.push(ex);
    }
    available = weighted;
  }

  const pick = available[Math.floor(Math.random() * available.length)];
  sessionUsed.add(pick.id);
  weeklyUsed.add(pick.id);
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

  const weeklyUsedArr = await getWeeklyUsedExerciseIds(weekStartStr);
  // Weekly-used set: shared across calls, mutated by pickRandom
  const weeklyUsed = new Set<number>(weeklyUsedArr);
  // Session-used set: tracks what's used in THIS generated workout (prevents duplicates within same workout)
  const sessionUsed = sessionUsedIds ?? new Set<number>();

  const ratings = await getExerciseRatings();
  const diffCond = difficultyFilter(difficultyLevel);
  const equipCond = equipmentFilter(equipment);

  async function getPool(slot: SlotFilter, relaxEquipment = false): Promise<Exercise[]> {
    const conditions = [diffCond, muscleFilter(slot.muscles)];
    if (!relaxEquipment && equipCond) conditions.push(equipCond);
    if (slot.isCompound) conditions.push(eq(exercisesTable.isCompound, true));
    return db.select().from(exercisesTable).where(and(...conditions));
  }

  async function pickForSlot(slot: SlotFilter): Promise<Exercise | undefined> {
    // Try with equipment constraint first
    let pool = await getPool(slot, false);
    let ex = pickRandom(pool, sessionUsed, weeklyUsed, ratings);
    if (ex) return ex;
    // Fallback: relax equipment restriction
    pool = await getPool(slot, true);
    ex = pickRandom(pool, sessionUsed, weeklyUsed, ratings);
    return ex;
  }

  const compoundEx = await pickForSlot(layout.compound);

  let compound2Ex: Exercise | undefined;
  if (layout.compound2) {
    compound2Ex = await pickForSlot(layout.compound2);
  }

  const circuits: { circuitNumber: number; exercises: { exercise: Exercise; lastLog: Awaited<ReturnType<typeof getLastLog>>; suggestedSets: number; suggestedReps: number }[] }[] = [];

  for (let i = 0; i < layout.circuits.length; i++) {
    const circuit = layout.circuits[i];
    const circuitExercises = [];
    for (const slot of circuit.slots) {
      const ex = await pickForSlot(slot);
      if (ex) {
        const lastLog = await getLastLog(ex.id);
        circuitExercises.push({ exercise: ex, lastLog, suggestedSets: 3, suggestedReps: 8 });
      }
    }
    // Ensure each circuit always has exactly 2 exercises (pad with any unused if needed)
    if (circuitExercises.length < circuit.slots.length) {
      const needed = circuit.slots.length - circuitExercises.length;
      // Use first slot muscle group as fallback
      const fallbackSlot = circuit.slots[0];
      for (let j = 0; j < needed; j++) {
        const fallbackPool = await getPool(fallbackSlot, true);
        const fallbackEx = pickRandom(fallbackPool, sessionUsed, weeklyUsed, ratings);
        if (fallbackEx) {
          const lastLog = await getLastLog(fallbackEx.id);
          circuitExercises.push({ exercise: fallbackEx, lastLog, suggestedSets: 3, suggestedReps: 8 });
        }
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

export function getPlanDates(period: "daily" | "weekly" | "monthly", startDate: string, cadence: number, count: number = 1): string[] {
  const start = new Date(startDate);
  if (period === "daily") {
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  const totalDays = period === "weekly" ? 7 * count : 30 * count;
  const workoutCount = period === "weekly" ? cadence * count : cadence * 4 * count;
  const dates: string[] = [];

  for (let i = 0; i < workoutCount; i++) {
    const d = new Date(start);
    const offset = Math.floor((i * totalDays) / workoutCount);
    d.setDate(start.getDate() + offset);
    dates.push(d.toISOString().split("T")[0]);
  }

  return dates;
}
