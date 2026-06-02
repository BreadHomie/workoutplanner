import { Router } from "express";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db";

const router = Router();

router.get("/profile", async (req, res): Promise<void> => {
  let [profile] = await db.select().from(userProfilesTable).limit(1);
  if (!profile) {
    [profile] = await db
      .insert(userProfilesTable)
      .values({
        difficultyLevel: "Beginner",
        equipment: ["Full Gym"],
        targetCadence: 3,
        preferredSplit: "Full Body",
      })
      .returning();
  }
  res.json(profile);
});

router.put("/profile", async (req, res): Promise<void> => {
  const { difficultyLevel, equipment, targetCadence, preferredSplit } = req.body as {
    difficultyLevel?: string;
    equipment?: string[];
    targetCadence?: number;
    preferredSplit?: string;
  };

  let [profile] = await db.select().from(userProfilesTable).limit(1);

  if (!profile) {
    [profile] = await db
      .insert(userProfilesTable)
      .values({
        difficultyLevel: difficultyLevel ?? "Beginner",
        equipment: equipment ?? ["Full Gym"],
        targetCadence: targetCadence ?? 3,
        preferredSplit: preferredSplit ?? "Full Body",
      })
      .returning();
  } else {
    const updates: Partial<typeof profile> = {};
    if (difficultyLevel !== undefined) updates.difficultyLevel = difficultyLevel;
    if (equipment !== undefined) updates.equipment = equipment;
    if (targetCadence !== undefined) updates.targetCadence = targetCadence;
    if (preferredSplit !== undefined) updates.preferredSplit = preferredSplit;

    const { eq } = await import("drizzle-orm");
    [profile] = await db
      .update(userProfilesTable)
      .set(updates)
      .where(eq(userProfilesTable.id, profile.id))
      .returning();
  }

  res.json(profile);
});

export default router;
