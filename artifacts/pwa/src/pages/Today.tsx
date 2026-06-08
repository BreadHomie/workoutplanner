import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Zap, RefreshCw, CheckCircle2, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { db } from "../db/index";
import { generateWorkout, SPLIT_CYCLES } from "../lib/workoutGenerator";
import type { WorkoutPlan, WorkoutSession, ExerciseWithHistory } from "../lib/types";

const EQUIPMENT_OPTIONS = ["Full Gym", "Bodyweight", "Dumbbells"];

function getMuscleLabels(ex: ExerciseWithHistory["exercise"]) {
  const tags: string[] = [];
  if (ex.hitChest) tags.push("Chest");
  if (ex.hitBack) tags.push("Back");
  if (ex.hitLegs) tags.push("Legs");
  if (ex.hitCore) tags.push("Core");
  if (ex.hitArm) tags.push("Arms");
  if (ex.hitShoulder) tags.push("Shoulders");
  return tags.slice(0, 3);
}

interface SetState {
  done: boolean;
  weight: string;
  reps: string;
}

function ExerciseBlock({
  item,
  isCompound,
  setsState,
  onToggleSet,
  onSetWeight,
  onSetReps,
}: {
  item: ExerciseWithHistory;
  isCompound: boolean;
  setsState: SetState[];
  onToggleSet: (idx: number) => void;
  onSetWeight: (idx: number, val: string) => void;
  onSetReps: (idx: number, val: string) => void;
}) {
  const muscleTags = getMuscleLabels(item.exercise);
  const lastWeightText = item.lastLog?.weightUsed
    ? `Last: ${item.lastLog.weightUsed} lbs`
    : item.lastLog
    ? "Last: BW"
    : null;

  return (
    <div className="exercise-card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
            {isCompound && (
              <span style={{
                background: "hsl(83 97% 59% / 0.2)",
                color: "hsl(83 97% 59%)",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 99,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}>Compound</span>
            )}
          </div>
          <div className="exercise-name">{item.exercise.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {muscleTags.map((t) => (
              <span key={t} className="muscle-tag">{t}</span>
            ))}
            <span style={{ fontSize: 11, color: "hsl(0 0% 50%)", marginLeft: 4, alignSelf: "center" }}>
              {item.exercise.equipment}
            </span>
          </div>
        </div>
        {lastWeightText && (
          <div style={{
            fontSize: 11,
            color: "hsl(83 97% 59%)",
            fontWeight: 600,
            background: "hsl(83 97% 59% / 0.1)",
            padding: "4px 8px",
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}>
            {lastWeightText}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {setsState.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className={`set-bubble${s.done ? " done" : ""}`}
              onClick={() => onToggleSet(i)}
              type="button"
            >
              {i + 1}
            </button>
            <input
              className="weight-input"
              type="number"
              placeholder="lbs"
              value={s.weight}
              onChange={(e) => onSetWeight(i, e.target.value)}
              inputMode="decimal"
              style={{ flex: "0 0 auto" }}
            />
            <span style={{ color: "hsl(0 0% 50%)", fontSize: 13 }}>×</span>
            <input
              className="weight-input"
              type="number"
              placeholder={String(item.suggestedReps)}
              value={s.reps}
              onChange={(e) => onSetReps(i, e.target.value)}
              inputMode="numeric"
              style={{ flex: "0 0 auto", width: 64 }}
            />
            <span style={{ color: "hsl(0 0% 50%)", fontSize: 12 }}>reps</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ExerciseSetsMap = Record<string, SetState[]>;

function initSets(count: number, suggestedReps: number): SetState[] {
  return Array.from({ length: count }, () => ({ done: false, weight: "", reps: String(suggestedReps) }));
}

export default function Today() {
  const profile = useLiveQuery(() => db.userProfile.toCollection().first());

  const [equipment, setEquipment] = useState<string[]>(["Full Gym", "Bodyweight", "Dumbbells"]);
  const [splitCycleKey, setSplitCycleKey] = useState("Full Body");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [setsMap, setSetsMap] = useState<ExerciseSetsMap>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [expandedCircuits, setExpandedCircuits] = useState<Set<number>>(new Set([0, 1, 2]));

  useEffect(() => {
    if (profile) {
      setEquipment(profile.equipment ?? ["Full Gym", "Bodyweight", "Dumbbells"]);
      setSplitCycleKey(profile.preferredSplit ?? "Full Body");
    }
  }, [profile?.id]);

  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  };

  const handleGenerate = async () => {
    if (!profile) return;
    setIsGenerating(true);
    setError(null);
    setActivePlan(null);
    setSessionId(null);
    setIsCompleted(false);

    try {
      const cyclePairs = SPLIT_CYCLES[splitCycleKey] ?? [["Full Body", "Standard"]];
      const [splitType, splitVariant] = cyclePairs[0];
      const today = new Date().toISOString().split("T")[0];
      const plan = await generateWorkout({
        splitType,
        splitVariant,
        difficultyLevel: profile.difficultyLevel,
        equipment,
        scheduledDate: today,
      });

      const sid = await db.workoutSessions.add({
        splitType,
        splitVariant,
        scheduledDate: today,
        isCompleted: false,
        workoutPlanJson: JSON.stringify(plan),
        createdAt: new Date().toISOString(),
      } as WorkoutSession);

      const initialMap: ExerciseSetsMap = {};
      const allItems: ExerciseWithHistory[] = [
        plan.compound,
        ...(plan.compound2 ? [plan.compound2] : []),
        ...plan.circuits.flatMap((c) => c.exercises),
      ];
      for (const item of allItems) {
        const key = String(item.exercise.id);
        const lastWeight = item.lastLog?.weightUsed ? String(item.lastLog.weightUsed) : "";
        initialMap[key] = Array.from({ length: item.suggestedSets }, () => ({
          done: false,
          weight: lastWeight,
          reps: String(item.suggestedReps),
        }));
      }

      setActivePlan(plan);
      setSessionId(typeof sid === "number" ? sid : null);
      setSetsMap(initialMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate workout");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSet = useCallback((exerciseId: number, setIdx: number) => {
    setSetsMap((prev) => {
      const key = String(exerciseId);
      const arr = [...(prev[key] ?? [])];
      arr[setIdx] = { ...arr[setIdx], done: !arr[setIdx].done };
      return { ...prev, [key]: arr };
    });
  }, []);

  const updateSetField = useCallback(
    (exerciseId: number, setIdx: number, field: "weight" | "reps", val: string) => {
      setSetsMap((prev) => {
        const key = String(exerciseId);
        const arr = [...(prev[key] ?? [])];
        arr[setIdx] = { ...arr[setIdx], [field]: val };
        return { ...prev, [key]: arr };
      });
    },
    []
  );

  const handleComplete = async () => {
    if (!activePlan || !sessionId) return;
    setIsSaving(true);
    try {
      const allItems: ExerciseWithHistory[] = [
        activePlan.compound,
        ...(activePlan.compound2 ? [activePlan.compound2] : []),
        ...activePlan.circuits.flatMap((c) => c.exercises),
      ];

      for (const item of allItems) {
        const key = String(item.exercise.id);
        const sets = setsMap[key] ?? [];
        const doneSets = sets.filter((s) => s.done);
        if (doneSets.length === 0) continue;
        const avgWeight = doneSets
          .map((s) => parseFloat(s.weight))
          .filter((w) => !isNaN(w));
        const weightUsed = avgWeight.length > 0 ? Math.round(avgWeight.reduce((a, b) => a + b) / avgWeight.length) : undefined;
        const reps = parseInt(doneSets[0]?.reps ?? String(item.suggestedReps)) || item.suggestedReps;

        await db.sessionLogs.add({
          sessionId,
          exerciseId: item.exercise.id,
          sets: doneSets.length,
          reps,
          weightUsed,
          isCompleted: true,
          loggedAt: new Date().toISOString(),
          setCompletions: JSON.stringify(doneSets),
        });
      }

      await db.workoutSessions.update(sessionId, {
        isCompleted: true,
        completedAt: new Date().toISOString(),
      });

      if (profile?.id) {
        await db.userProfile.update(profile.id, {
          totalXp: (profile.totalXp ?? 0) + 100,
          updatedAt: new Date().toISOString(),
        });
      }

      setIsCompleted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setActivePlan(null);
    setSessionId(null);
    setSetsMap({});
    setIsCompleted(false);
    setError(null);
  };

  if (isCompleted) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 32 }}>
        <CheckCircle2 size={72} color="hsl(83 97% 59%)" strokeWidth={1.5} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Workout Complete!</div>
          <div style={{ fontSize: 14, color: "hsl(0 0% 50%)", marginTop: 8 }}>+100 XP earned</div>
        </div>
        <button className="btn-primary" onClick={handleReset} style={{ maxWidth: 280 }}>
          <Zap size={18} />
          Generate Next Workout
        </button>
      </div>
    );
  }

  if (activePlan) {
    const allDone =
      activePlan.compound && (setsMap[String(activePlan.compound.exercise.id)]?.some((s) => s.done));

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "hsl(0 0% 95%)" }}>
              {activePlan.splitType}
              {activePlan.splitVariant !== "Standard" && (
                <span style={{ color: "hsl(83 97% 59%)", marginLeft: 8, fontSize: 16 }}>
                  + Core
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>
              Tap sets to mark done • Enter weight to track progress
            </div>
          </div>
          <button className="btn-secondary" onClick={handleReset} style={{ padding: "6px 12px" }}>
            <RefreshCw size={14} />
            New
          </button>
        </div>

        {/* Scrollable workout */}
        <div className="scroll-area" style={{ flex: 1, padding: "0 16px 16px" }}>
          {/* Compound(s) */}
          <div className="section-label" style={{ marginTop: 8 }}>Compound</div>
          <ExerciseBlock
            item={activePlan.compound}
            isCompound={true}
            setsState={setsMap[String(activePlan.compound.exercise.id)] ?? []}
            onToggleSet={(i) => toggleSet(activePlan.compound.exercise.id, i)}
            onSetWeight={(i, v) => updateSetField(activePlan.compound.exercise.id, i, "weight", v)}
            onSetReps={(i, v) => updateSetField(activePlan.compound.exercise.id, i, "reps", v)}
          />
          {activePlan.compound2 && (
            <div style={{ marginTop: 8 }}>
              <ExerciseBlock
                item={activePlan.compound2}
                isCompound={true}
                setsState={setsMap[String(activePlan.compound2.exercise.id)] ?? []}
                onToggleSet={(i) => toggleSet(activePlan.compound2!.exercise.id, i)}
                onSetWeight={(i, v) => updateSetField(activePlan.compound2!.exercise.id, i, "weight", v)}
                onSetReps={(i, v) => updateSetField(activePlan.compound2!.exercise.id, i, "reps", v)}
              />
            </div>
          )}

          {/* Circuits */}
          {activePlan.circuits.map((circuit, ci) => {
            const isExpanded = expandedCircuits.has(ci);
            return (
              <div key={ci} style={{ marginTop: 16 }}>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 0",
                    marginBottom: 8,
                  }}
                  onClick={() => setExpandedCircuits((prev) => {
                    const next = new Set(prev);
                    if (next.has(ci)) next.delete(ci); else next.add(ci);
                    return next;
                  })}
                >
                  <span className="section-label" style={{ margin: 0 }}>Circuit {ci + 1}</span>
                  {isExpanded ? <ChevronDown size={16} color="hsl(0 0% 50%)" /> : <ChevronRight size={16} color="hsl(0 0% 50%)" />}
                </button>
                {isExpanded && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {circuit.exercises.map((item) => (
                      <ExerciseBlock
                        key={item.exercise.id}
                        item={item}
                        isCompound={false}
                        setsState={setsMap[String(item.exercise.id)] ?? []}
                        onToggleSet={(i) => toggleSet(item.exercise.id, i)}
                        onSetWeight={(i, v) => updateSetField(item.exercise.id, i, "weight", v)}
                        onSetReps={(i, v) => updateSetField(item.exercise.id, i, "reps", v)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Complete button */}
          <div style={{ marginTop: 24, paddingBottom: 8 }}>
            <button
              className="btn-primary"
              onClick={handleComplete}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {isSaving ? "Saving…" : "Complete Workout"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <Zap size={22} color="hsl(83 97% 59%)" fill="hsl(83 97% 59%)" />
          <span style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Glide Fitness</span>
        </div>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
        {/* Equipment */}
        <div className="section-label" style={{ marginTop: 16 }}>Equipment</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {EQUIPMENT_OPTIONS.map((eq) => (
            <button
              key={eq}
              type="button"
              className={`chip${equipment.includes(eq) ? " active" : ""}`}
              onClick={() => toggleEquipment(eq)}
            >
              {eq}
            </button>
          ))}
        </div>

        {/* Split */}
        <div className="section-label" style={{ marginTop: 20 }}>Workout Split</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.keys(SPLIT_CYCLES).map((key) => {
            const isActive = splitCycleKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSplitCycleKey(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: `2px solid ${isActive ? "hsl(83 97% 59%)" : "hsl(0 0% 15%)"}`,
                  background: isActive ? "hsl(83 97% 59% / 0.08)" : "hsl(0 0% 9%)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: isActive ? "hsl(83 97% 59%)" : "hsl(0 0% 85%)",
                }}>{key}</span>
                <span style={{ fontSize: 12, color: "hsl(0 0% 45%)" }}>
                  {SPLIT_CYCLES[key].length} day{SPLIT_CYCLES[key].length > 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>

        {/* Generate */}
        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "hsl(0 72% 51% / 0.12)", color: "hsl(0 72% 65%)", fontSize: 13 }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: 24 }}>
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating || equipment.length === 0}
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
            {isGenerating ? "Generating…" : "Generate Workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
