---
name: Workout generator split layouts
description: How split types map to compound/circuit muscle group slots in workoutGenerator.ts
---

The workout generator lives in `artifacts/api-server/src/lib/workoutGenerator.ts`.

**Key:** SPLIT_LAYOUTS map. Keys are: "Full Body", "Upper", "Upper_Core", "Lower", "Lower_Core", "Push", "Pull", "Legs", "Legs_Core"

**Rule:** For Core variants of Lower/Legs/Upper splits, the key is `${splitType}_Core`. The route receives `splitVariant: "Core"` and builds the key accordingly.

**Why:** The workout split structure (compound movement + 3 circuits of 2 exercises each) comes from the user's Notes file. Each slot in a circuit specifies which muscle groups (`hitChest`, `hitBack`, `hitLegs`, `hitCore`, `hitArm`, `hitShoulder`) the exercise must target.

**How to apply:** When adding new split types, add both the base key and the `_Core` variant if it has a different circuit structure. The generator auto-builds the layout key from splitType + splitVariant.
