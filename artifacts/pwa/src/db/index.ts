import Dexie, { type Table } from "dexie";
import type { Exercise, SessionLog, WorkoutSession, UserProfile, ScheduleEntry, Client } from "../lib/types";
import exercisesRaw from "@assets/exercises_seed.json";

const EXERCISES: Exercise[] = (exercisesRaw as any[]).map((e) => ({
  ...e,
  equipment: e.equipment === "Dumbbells only" ? "Dumbbells" : e.equipment,
  isActive: true,
}));

class GlideDb extends Dexie {
  exercises!: Table<Exercise, number>;
  workoutSessions!: Table<WorkoutSession, number>;
  sessionLogs!: Table<SessionLog, number>;
  userProfile!: Table<UserProfile, number>;
  schedule!: Table<ScheduleEntry, number>;
  clients!: Table<Client, number>;

  constructor() {
    super("glide-fitness");
    this.version(1).stores({
      exercises: "id, equipment, difficulty, isCompound, hitChest, hitBack, hitLegs, hitCore, hitArm, hitShoulder",
      workoutSessions: "++id, scheduledDate, isCompleted, createdAt",
      sessionLogs: "++id, sessionId, exerciseId, loggedAt",
      userProfile: "++id",
      schedule: "++id, date",
    });
    this.version(2).stores({
      exercises: "id, equipment, difficulty, isCompound, hitChest, hitBack, hitLegs, hitCore, hitArm, hitShoulder",
      workoutSessions: "++id, scheduledDate, isCompleted, createdAt, clientId",
      sessionLogs: "++id, sessionId, exerciseId, loggedAt",
      userProfile: "++id",
      schedule: "++id, date, clientId",
      clients: "++id, name, createdAt",
    });
    this.version(3).stores({
      exercises: "id, equipment, difficulty, isCompound, hitChest, hitBack, hitLegs, hitCore, hitArm, hitShoulder, isActive",
      workoutSessions: "++id, scheduledDate, isCompleted, createdAt, clientId",
      sessionLogs: "++id, sessionId, exerciseId, loggedAt",
      userProfile: "++id",
      schedule: "++id, date, clientId",
      clients: "++id, name, createdAt",
    }).upgrade(async (tx) => {
      await tx.table("exercises").toCollection().modify((ex: any) => {
        if (ex.isActive === undefined) ex.isActive = true;
      });
    });
  }
}

export const db = new GlideDb();

export async function initializeDb(): Promise<void> {
  try { await navigator.storage?.persist?.(); } catch (_) {}

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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}
