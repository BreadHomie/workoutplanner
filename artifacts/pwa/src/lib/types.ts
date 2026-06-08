export interface Exercise {
  id: number;
  name: string;
  equipment: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  isCompound: boolean;
  hitChest: boolean;
  hitBack: boolean;
  hitLegs: boolean;
  hitCore: boolean;
  hitArm: boolean;
  hitShoulder: boolean;
  classification: string;
}

export interface SessionLog {
  id?: number;
  sessionId: number;
  exerciseId: number;
  sets: number;
  reps: number;
  weightUsed?: number;
  notes?: string;
  setCompletions?: string;
  isCompleted: boolean;
  loggedAt: string;
}

export interface ExerciseWithHistory {
  exercise: Exercise;
  lastLog: SessionLog | null;
  suggestedSets: number;
  suggestedReps: number;
}

export interface Circuit {
  circuitNumber: number;
  exercises: ExerciseWithHistory[];
}

export interface WorkoutPlan {
  splitType: string;
  splitVariant: string;
  compound: ExerciseWithHistory;
  compound2?: ExerciseWithHistory;
  circuits: Circuit[];
  scheduledDate?: string;
}

export interface WorkoutSession {
  id?: number;
  splitType: string;
  splitVariant: string;
  scheduledDate?: string;
  completedAt?: string;
  isCompleted: boolean;
  photoUri?: string;
  workoutPlanJson?: string;
  clientId?: number;
  createdAt: string;
}

export interface UserProfile {
  id?: number;
  difficultyLevel: string;
  equipment: string[];
  targetCadence: number;
  preferredSplit: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEntry {
  id?: number;
  date: string;
  splitType?: string;
  splitVariant?: string;
  clientId?: number;
}

export interface Client {
  id?: number;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const EQUIPMENT_OPTIONS = ["Full Gym", "Bodyweight", "Dumbbells"] as const;
export const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"] as const;
