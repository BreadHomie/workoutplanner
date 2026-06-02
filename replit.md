# Glide Fitness

A fitness tracking and workout generation mobile app. Users generate personalized workouts based on their split, difficulty, and equipment — with progressive overload built in.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/mobile run dev` — run the Expo mobile app (port 18115)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed exercise library from data
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo 54, Expo Router 6, React Native 0.81
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (exercises, userProfiles, workoutSessions, sessionLogs, schedule)
- `artifacts/api-server/src/routes/` — Express route handlers (profile, exercises, workouts, sessions, schedule)
- `artifacts/api-server/src/lib/workoutGenerator.ts` — core workout generation logic with split layouts
- `artifacts/mobile/app/(tabs)/` — 4 screens: Today (generate), History, Schedule, Profile
- `artifacts/mobile/constants/colors.ts` — design tokens (dark athletic theme, electric lime primary)
- `scripts/src/seed.ts` — exercise library seed script (120 exercises)
- `attached_assets/exercises_seed.json` — parsed exercise data from Excel

## Architecture decisions

- Workout generator enforces weekly non-repetition: queries `session_logs` joined with `workout_sessions.scheduled_date` for the current week to exclude already-used exercises
- Hierarchical difficulty: Beginner = B only, Intermediate = B+I, Advanced = B+I+A (enforced via `inArray` on the exercises table)
- Progressive overload: generator calls `getLastLog(exerciseId)` for each selected exercise and returns `lastLog` alongside the exercise so the client can show "Last: X lbs"
- Split layouts are encoded as a `SPLIT_LAYOUTS` map in `workoutGenerator.ts` — each split has compound slot(s) + 3 circuit layouts with muscle-group filters per slot
- Equipment filtering uses `equipment IN (user_selections)` — multi-select means any exercise whose equipment matches any selected option is included
- Single user profile row: profile GET creates a default row on first access

## Product

- **Today tab:** Pick split type (Full Body / Upper / Lower / Push / Pull / Legs) and variant (Standard / Core). Generate a workout respecting difficulty, equipment, and weekly non-repetition. See your last logged weight for each exercise. Log sets/reps/weight after the session.
- **History tab:** Browse past sessions, expand to see all logged exercises with weights.
- **Schedule tab:** Weekly calendar view to plan workouts ahead. Tap a day to generate.
- **Profile tab:** Set difficulty level, equipment availability, target cadence, preferred split. Stats summary at top.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml` before using the generated hooks
- The `workoutGenerator.ts` resolves split key as `${splitType}_Core` for core variants of Lower/Legs/Upper — if you add new splits, add both the base and `_Core` variant keys
- `date-fns` is installed in `@workspace/mobile` (added manually — it was not in the original scaffold)
- Exercise seeding is idempotent: checks for existing rows before inserting

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
