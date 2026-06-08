import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Zap, CheckCircle2, ChevronRight, ChevronDown, Loader2, Save, Check } from "lucide-react";
import { db } from "../db/index";
import { generateWorkout, SPLIT_CYCLES } from "../lib/workoutGenerator";
import type { WorkoutPlan, WorkoutSession, ExerciseWithHistory, SessionLog } from "../lib/types";

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
  weight: string;
  reps: string;
}

type SetsMap = Record<string, SetState[]>;

function ExerciseBlock({
  item,
  isCompound,
  setsState,
  onSetWeight,
  onSetReps,
  onSave,
  savedNotification,
}: {
  item: ExerciseWithHistory;
  isCompound: boolean;
  setsState: SetState[];
  onSetWeight: (idx: number, val: string) => void;
  onSetReps: (idx: number, val: string) => void;
  onSave: () => void;
  savedNotification: boolean;
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
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
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
            <span style={{ fontSize: 11, color: "hsl(0 0% 45%)", alignSelf: "center" }}>
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
            flexShrink: 0,
          }}>
            {lastWeightText}
          </div>
        )}
      </div>

      {/* Set rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {setsState.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              background: "hsl(0 0% 18%)",
              color: "hsl(0 0% 55%)",
              flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <input
              className="weight-input"
              type="number"
              placeholder="lbs"
              value={s.weight}
              onChange={(e) => onSetWeight(i, e.target.value)}
              inputMode="decimal"
            />
            <span style={{ color: "hsl(0 0% 45%)", fontSize: 13 }}>×</span>
            <input
              className="weight-input"
              type="number"
              placeholder={String(item.suggestedReps)}
              value={s.reps}
              onChange={(e) => onSetReps(i, e.target.value)}
              inputMode="numeric"
              style={{ width: 64 }}
            />
            <span style={{ color: "hsl(0 0% 45%)", fontSize: 12 }}>reps</span>
          </div>
        ))}
      </div>

      {/* Save row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {savedNotification && (
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: "hsl(83 97% 59%)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            opacity: 1,
            transition: "opacity 0.3s",
          }}>
            <Check size={13} />
            Saved
          </span>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={onSave}
          style={{ height: 34, padding: "0 14px", fontSize: 13 }}
        >
          <Save size={13} />
          Save
        </button>
      </div>
    </div>
  );
}

export default function Generate() {
  const profile = useLiveQuery(() => db.userProfile.toCollection().first());
  const clients = useLiveQuery(() => db.clients.orderBy("name").toArray(), []);

  const [equipment, setEquipment] = useState<string[]>(["Full Gym", "Bodyweight", "Dumbbells"]);
  const [splitCycleKey, setSplitCycleKey] = useState("Full Body");
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [setsMap, setSetsMap] = useState<SetsMap>({});
  const [savedNotifications, setSavedNotifications] = useState<Set<number>>(new Set());
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
    setSavedNotifications(new Set());

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
        clientId: selectedClientId,
      });

      const sid = await db.workoutSessions.add({
        splitType,
        splitVariant,
        scheduledDate: today,
        isCompleted: false,
        workoutPlanJson: JSON.stringify(plan),
        clientId: selectedClientId,
        createdAt: new Date().toISOString(),
      } as WorkoutSession);

      const initialMap: SetsMap = {};
      const allItems: ExerciseWithHistory[] = [
        plan.compound,
        ...(plan.compound2 ? [plan.compound2] : []),
        ...plan.circuits.flatMap((c) => c.exercises),
      ];
      for (const item of allItems) {
        const key = String(item.exercise.id);
        const lastSetCompletions = item.lastLog?.setCompletions
          ? (() => { try { return JSON.parse(item.lastLog.setCompletions!); } catch { return null; } })()
          : null;
        const lastWeight = item.lastLog?.weightUsed ? String(item.lastLog.weightUsed) : "";
        initialMap[key] = Array.from({ length: item.suggestedSets }, (_, i) => ({
          weight: lastSetCompletions?.[i]?.weight ?? lastWeight,
          reps: lastSetCompletions?.[i]?.reps ?? String(item.suggestedReps),
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

  const handleSaveExercise = useCallback(async (exerciseId: number) => {
    if (!sessionId) return;
    const key = String(exerciseId);
    const sets = setsMap[key] ?? [];

    const logData: Omit<SessionLog, "id"> = {
      sessionId,
      exerciseId,
      sets: sets.length,
      reps: parseInt(sets[0]?.reps ?? "8") || 8,
      weightUsed: (() => {
        const weights = sets.map((s) => parseFloat(s.weight)).filter((w) => !isNaN(w) && w > 0);
        return weights.length > 0 ? weights[0] : undefined;
      })(),
      isCompleted: true,
      loggedAt: new Date().toISOString(),
      setCompletions: JSON.stringify(sets),
    };

    const existing = await db.sessionLogs
      .where("sessionId")
      .equals(sessionId)
      .filter((l) => l.exerciseId === exerciseId)
      .first();

    if (existing?.id) {
      await db.sessionLogs.update(existing.id, logData);
    } else {
      await db.sessionLogs.add(logData);
    }

    setSavedNotifications((prev) => new Set([...prev, exerciseId]));
    setTimeout(() => {
      setSavedNotifications((prev) => {
        const next = new Set(prev);
        next.delete(exerciseId);
        return next;
      });
    }, 2500);
  }, [sessionId, setsMap]);

  const handleComplete = async () => {
    if (!activePlan || !sessionId) return;
    await db.workoutSessions.update(sessionId, {
      isCompleted: true,
      completedAt: new Date().toISOString(),
    });
    setIsCompleted(true);
  };

  const handleReset = () => {
    setActivePlan(null);
    setSessionId(null);
    setSetsMap({});
    setIsCompleted(false);
    setError(null);
    setSavedNotifications(new Set());
  };

  if (isCompleted) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 32 }}>
        <CheckCircle2 size={72} color="hsl(83 97% 59%)" strokeWidth={1.5} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Workout Complete!</div>
          {selectedClientId && clients && (
            <div style={{ fontSize: 14, color: "hsl(0 0% 50%)", marginTop: 6 }}>
              {clients.find((c) => c.id === selectedClientId)?.name ?? ""}
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={handleReset} style={{ maxWidth: 280 }}>
          <Zap size={18} />
          Generate Another
        </button>
      </div>
    );
  }

  if (activePlan) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "hsl(0 0% 95%)" }}>
              {activePlan.splitType}
              {activePlan.splitVariant !== "Standard" && (
                <span style={{ color: "hsl(83 97% 59%)", marginLeft: 8, fontSize: 16 }}>+ Core</span>
              )}
            </div>
            {selectedClientId && clients && (
              <div style={{ fontSize: 13, color: "hsl(83 97% 59%)", fontWeight: 600 }}>
                {clients.find((c) => c.id === selectedClientId)?.name ?? ""}
              </div>
            )}
            <div style={{ fontSize: 12, color: "hsl(0 0% 40%)", marginTop: 2 }}>
              Save each exercise after entering weights
            </div>
          </div>
          <button className="btn-secondary" onClick={handleReset} style={{ padding: "6px 14px", fontSize: 13 }}>
            New
          </button>
        </div>

        <div className="scroll-area" style={{ flex: 1, padding: "0 16px 16px" }}>
          <div className="section-label" style={{ marginTop: 8 }}>Compound</div>
          <ExerciseBlock
            item={activePlan.compound}
            isCompound={true}
            setsState={setsMap[String(activePlan.compound.exercise.id)] ?? []}
            onSetWeight={(i, v) => updateSetField(activePlan.compound.exercise.id, i, "weight", v)}
            onSetReps={(i, v) => updateSetField(activePlan.compound.exercise.id, i, "reps", v)}
            onSave={() => handleSaveExercise(activePlan.compound.exercise.id)}
            savedNotification={savedNotifications.has(activePlan.compound.exercise.id)}
          />
          {activePlan.compound2 && (
            <div style={{ marginTop: 8 }}>
              <ExerciseBlock
                item={activePlan.compound2}
                isCompound={true}
                setsState={setsMap[String(activePlan.compound2.exercise.id)] ?? []}
                onSetWeight={(i, v) => updateSetField(activePlan.compound2!.exercise.id, i, "weight", v)}
                onSetReps={(i, v) => updateSetField(activePlan.compound2!.exercise.id, i, "reps", v)}
                onSave={() => handleSaveExercise(activePlan.compound2!.exercise.id)}
                savedNotification={savedNotifications.has(activePlan.compound2.exercise.id)}
              />
            </div>
          )}

          {activePlan.circuits.map((circuit, ci) => {
            const isExpanded = expandedCircuits.has(ci);
            return (
              <div key={ci} style={{ marginTop: 16 }}>
                <button
                  type="button"
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 8 }}
                  onClick={() => setExpandedCircuits((prev) => {
                    const next = new Set(prev);
                    if (next.has(ci)) next.delete(ci); else next.add(ci);
                    return next;
                  })}
                >
                  <span className="section-label" style={{ margin: 0 }}>Circuit {ci + 1}</span>
                  {isExpanded
                    ? <ChevronDown size={16} color="hsl(0 0% 50%)" />
                    : <ChevronRight size={16} color="hsl(0 0% 50%)" />}
                </button>
                {isExpanded && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {circuit.exercises.map((item) => (
                      <ExerciseBlock
                        key={item.exercise.id}
                        item={item}
                        isCompound={false}
                        setsState={setsMap[String(item.exercise.id)] ?? []}
                        onSetWeight={(i, v) => updateSetField(item.exercise.id, i, "weight", v)}
                        onSetReps={(i, v) => updateSetField(item.exercise.id, i, "reps", v)}
                        onSave={() => handleSaveExercise(item.exercise.id)}
                        savedNotification={savedNotifications.has(item.exercise.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: 24, paddingBottom: 8 }}>
            <button className="btn-primary" onClick={handleComplete}>
              <CheckCircle2 size={18} />
              Complete Workout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <Zap size={22} color="hsl(83 97% 59%)" fill="hsl(83 97% 59%)" />
          <span style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Generate</span>
        </div>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
        {/* Client selector */}
        <div className="section-label" style={{ marginTop: 16 }}>Client</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button"
            className={`chip${selectedClientId === undefined ? " active" : ""}`}
            onClick={() => setSelectedClientId(undefined)}
            style={{ justifyContent: "flex-start", borderRadius: 10, padding: "10px 14px" }}
          >
            No client (general)
          </button>
          {clients && clients.length > 0 && clients.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip${selectedClientId === c.id ? " active" : ""}`}
              onClick={() => setSelectedClientId(c.id)}
              style={{ justifyContent: "flex-start", borderRadius: 10, padding: "10px 14px" }}
            >
              {c.name}
            </button>
          ))}
          {clients && clients.length === 0 && (
            <div style={{ fontSize: 12, color: "hsl(0 0% 40%)", padding: "6px 2px" }}>
              Add clients in the Clientele tab
            </div>
          )}
        </div>

        {/* Equipment */}
        <div className="section-label" style={{ marginTop: 20 }}>Equipment</div>
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

        {/* Workout Split */}
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
                <span style={{ fontSize: 15, fontWeight: 600, color: isActive ? "hsl(83 97% 59%)" : "hsl(0 0% 85%)" }}>
                  {key}
                </span>
                <span style={{ fontSize: 12, color: "hsl(0 0% 45%)" }}>
                  {SPLIT_CYCLES[key].length} day{SPLIT_CYCLES[key].length > 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>

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
