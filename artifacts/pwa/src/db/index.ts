import Dexie, { type Table } from "dexie";
import type { Exercise, SessionLog, WorkoutSession, UserProfile, ScheduleEntry } from "../lib/types";
import exercisesRaw from "@assets/exercises_seed.json";

const EXERCISES: Exercise[] = (exercisesRaw as any[]).map((e) => ({
  ...e,
  equipment: e.equipment === "Dumbbells only" ? "Dumbbells" : e.equipment,
}));

class GlideDb extends Dexie {
  exercises!: Table<Exercise, number>;
  workoutSessions!: Table<WorkoutSession, number>;
  sessionLogs!: Table<SessionLog, number>;
  userProfile!: Table<UserProfile, number>;
  schedule!: Table<ScheduleEntry, number>;

  constructor() {
    super("glide-fitness");
    this.version(1).stores({
      exercises:
        "id, equipment, difficulty, isCompound, hitChest, hitBack, hitLegs, hitCore, hitArm, hitShoulder",
      workoutSessions: "++id, scheduledDate, isCompleted, createdAt",
      sessionLogs: "++id, sessionId, exerciseId, loggedAt",
      userProfile: "++id",
      schedule: "++id, date",
    });
  }
}

export const db = new GlideDb();

export async function initializeDb(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch (_) {}

  const exCount = await db.exercises.count();
  if (exCount === 0) {
    await db.exercises.bulkPut(EXERCISES);
  }

  const profileCount = await db.userProfile.count();
  if (profileCount === 0) {
    await db.userProfile.add({
      difficultyLevel: "Intermediate",
      equipment: ["Full Gym", "Bodyweight", "Dumbbells"],
      targetCadence: 3,
      preferredSplit: "Full Body",
      totalXp: 0,
      totalCoins: 0,
      level: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}
