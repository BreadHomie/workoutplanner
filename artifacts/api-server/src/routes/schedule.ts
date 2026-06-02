import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { scheduleTable } from "@workspace/db";

const router = Router();

router.get("/schedule", async (_req, res): Promise<void> => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 14);

  const entries = await db
    .select()
    .from(scheduleTable)
    .orderBy(scheduleTable.scheduledDate);

  res.json(entries);
});

router.post("/schedule", async (req, res): Promise<void> => {
  const { scheduledDate, splitType, splitVariant } = req.body as {
    scheduledDate?: string;
    splitType?: string;
    splitVariant?: string;
  };

  if (!scheduledDate || !splitType || !splitVariant) {
    res.status(400).json({ error: "scheduledDate, splitType, and splitVariant are required" });
    return;
  }

  const [entry] = await db
    .insert(scheduleTable)
    .values({ scheduledDate, splitType, splitVariant })
    .returning();

  res.status(201).json(entry);
});

router.delete("/schedule/:entryId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.entryId) ? req.params.entryId[0] : req.params.entryId;
  const entryId = parseInt(raw, 10);

  if (isNaN(entryId)) {
    res.status(400).json({ error: "Invalid entry ID" });
    return;
  }

  await db.delete(scheduleTable).where(eq(scheduleTable.id, entryId));
  res.sendStatus(204);
});

export default router;
