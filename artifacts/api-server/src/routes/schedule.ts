import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { scheduleTable } from "@workspace/db";

const router = Router();

router.get("/schedule", async (_req, res): Promise<void> => {
  const entries = await db.select().from(scheduleTable).orderBy(scheduleTable.scheduledDate);
  res.json(entries);
});

router.post("/schedule", async (req, res): Promise<void> => {
  const { scheduledDate, splitType, splitVariant } = req.body as {
    scheduledDate?: string; splitType?: string; splitVariant?: string;
  };
  if (!scheduledDate || !splitType || !splitVariant) {
    res.status(400).json({ error: "scheduledDate, splitType, and splitVariant are required" });
    return;
  }
  const [entry] = await db.insert(scheduleTable).values({ scheduledDate, splitType, splitVariant }).returning();
  res.status(201).json(entry);
});

// Bulk save — replace all entries for a given month (YYYY-MM)
router.put("/schedule/bulk", async (req, res): Promise<void> => {
  const { yearMonth, dates } = req.body as { yearMonth?: string; dates?: string[] };
  if (!yearMonth || !dates) {
    res.status(400).json({ error: "yearMonth and dates are required" });
    return;
  }

  // Delete existing entries for this month
  await db.delete(scheduleTable).where(
    sql`to_char(${scheduleTable.scheduledDate}::date, 'YYYY-MM') = ${yearMonth}`
  );

  if (dates.length === 0) {
    res.json([]);
    return;
  }

  const rows = dates.map(d => ({ scheduledDate: d, splitType: "Full Body", splitVariant: "Standard" }));
  const entries = await db.insert(scheduleTable).values(rows).returning();
  res.json(entries);
});

router.delete("/schedule/:entryId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.entryId) ? req.params.entryId[0] : req.params.entryId;
  const entryId = parseInt(raw, 10);
  if (isNaN(entryId)) { res.status(400).json({ error: "Invalid entry ID" }); return; }
  await db.delete(scheduleTable).where(eq(scheduleTable.id, entryId));
  res.sendStatus(204);
});

export default router;
