import { Router } from "express";
import { generateWorkout } from "../lib/workoutGenerator";

const router = Router();

router.post("/workouts/generate", async (req, res): Promise<void> => {
  const { splitType, splitVariant, difficultyLevel, equipment, scheduledDate } = req.body as {
    splitType?: string;
    splitVariant?: string;
    difficultyLevel?: string;
    equipment?: string[];
    scheduledDate?: string;
  };

  if (!splitType || !difficultyLevel || !equipment) {
    res.status(400).json({ error: "splitType, difficultyLevel, and equipment are required" });
    return;
  }

  const workout = await generateWorkout({
    splitType,
    splitVariant: splitVariant ?? "Standard",
    difficultyLevel,
    equipment,
    scheduledDate,
  });

  res.json(workout);
});

export default router;
