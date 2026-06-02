---
name: Exercise seeding and date-fns
description: Exercise seed script location and a non-obvious package gap in mobile
---

**Seed:** `scripts/src/seed.ts` — run with `pnpm --filter @workspace/scripts run seed`. Idempotent (checks for existing rows). 120 exercises covering Full Gym, Dumbbells only, and Bodyweight with all muscle group flags.

**date-fns gap:** The design subagent used `date-fns` in the schedule and history screens but it was not in the mobile scaffold. Had to manually install: `pnpm --filter @workspace/mobile add date-fns`. This will happen again if the subagent writes schedule/calendar UI.

**Why:** Expo scaffold doesn't include date-fns. The subagent assumed it was available. Always check for this after a design subagent run that includes date/calendar features.
