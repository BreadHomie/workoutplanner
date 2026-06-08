import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Zap, CheckCircle2, ChevronRight, ChevronDown, Loader2, Save, Check, Minus, Plus, CalendarCheck } from "lucide-react";
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

interface SetState { weight: string; reps: string; }
type SetsMap = Record<string, SetState[]>;

function ExerciseBlock({ item, isCompound, setsState, onSetWeight, onSetReps, onSave, savedNotification }: {
  item: ExerciseWithHistory; isCompound: boolean; setsState: SetState[];
  onSetWeight: (idx: number, val: string) => void; onSetReps: (idx: number, val: string) => void;
  onSave: () => void; savedNotification: boolean;
}) {
  const muscleTags = getMuscleLabels(item.exercise);
  const lastWeightText = item.lastLog?.weightUsed ? `Last: ${item.lastLog.weightUsed} lbs` : item.lastLog ? "Last: BW" : null;

  return (
    <div className="exercise-card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          {isCompound && (
            <span style={{ background: "hsl(83 97% 59% / 0.2)", color: "hsl(83 97% 59%)", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, letterSpacing: "0.06em", textTransform: "uppercase" as const, display: "inline-block", marginBottom: 4 }}>
              Compound
            </span>
          )}
          <div className="exercise-name">{item.exercise.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginTop: 6 }}>
            {muscleTags.map((t) => <span key={t} className="muscle-tag">{t}</span>)}
            <span style={{ fontSize: 11, color: "hsl(0 0% 45%)", alignSelf: "center" }}>{item.exercise.equipment}</span>
          </div>
        </div>
        {lastWeightText && (
          <div style={{ fontSize: 11, color: "hsl(83 97% 59%)", fontWeight: 600, background: "hsl(83 97% 59% / 0.1)", padding: "4px 8px", borderRadius: 8, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
            {lastWeightText}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {setsState.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: "hsl(0 0% 18%)", color: "hsl(0 0% 55%)", flexShrink: 0 }}>
              {i + 1}
            </div>
            <input className="weight-input" type="number" placeholder="lbs" value={s.weight}
              onChange={(e) => onSetWeight(i, e.target.value)} inputMode="decimal" />
            <span style={{ color: "hsl(0 0% 45%)", fontSize: 13 }}>×</span>
            <input className="weight-input" type="number" placeholder={String(item.suggestedReps)} value={s.reps}
              onChange={(e) => onSetReps(i, e.target.value)} inputMode="numeric" style={{ width: 64 }} />
            <span style={{ color: "hsl(0 0% 45%)", fontSize: 12 }}>reps</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {savedNotification && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(83 97% 59%)", display: "flex", alignItems: "center", gap: 4 }}>
            <Check size={13} /> Saved
          </span>
        )}
        <button type="button" className="btn-secondary" onClick={onSave} style={{ height: 34, padding: "0 14px", fontSize: 13 }}>
          <Save size={13} /> Save
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
  const [planDuration, setPlanDuration] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [setsMap, setSetsMap] = useState<SetsMap>({});
  const [savedNotifications, setSavedNotifications] = useState<Set<number>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);
  const [expandedCircuits, setExpandedCircuits] = useState<Set<number>>(new Set([0, 1, 2]));
  const [scheduledSummary, setScheduledSummary] = useState<Array<{ date: string; split: string }> | null>(null);

  useEffect(() => {
    if (profile) {
      setEquipment(profile.equipment ?? ["Full Gym", "Bodyweight", "Dumbbells"]);
      setSplitCycleKey(profile.preferredSplit ?? "Full Body");
    }
  }, [profile?.id]);

  const toggleEquipment = (item: string) => {
    setEquipment((prev) => prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]);
  };

  const handleGenerate = async () => {
    if (!profile) return;
    setIsGenerating(true);
    setError(null);
    setActivePlan(null);
    setSessionId(null);
    setIsCompleted(false);
    setSavedNotifications(new Set());
    setScheduledSummary(null);

    try {
      const cyclePairs = SPLIT_CYCLES[splitCycleKey] ?? [["Full Body", "Standard"]];

      if (planDuration === 1) {
        // Single workout — show immediately for logging
        const [splitType, splitVariant] = cyclePairs[0];
        const today = new Date().toISOString().split("T")[0];
        const plan = await generateWorkout({ splitType, splitVariant, difficultyLevel: profile.difficultyLevel, equipment, scheduledDate: today, clientId: selectedClientId });
        const sid = await db.workoutSessions.add({
          splitType, splitVariant, scheduledDate: today, isCompleted: false,
          workoutPlanJson: JSON.stringify(plan), clientId: selectedClientId, createdAt: new Date().toISOString(),
        } as WorkoutSession);

        const allItems: ExerciseWithHistory[] = [plan.compound, ...(plan.compound2 ? [plan.compound2] : []), ...plan.circuits.flatMap((c) => c.exercises)];
        const initialMap: SetsMap = {};
        for (const item of allItems) {
          const key = String(item.exercise.id);
          const lastSetCompletions = item.lastLog?.setCompletions ? (() => { try { return JSON.parse(item.lastLog!.setCompletions!); } catch { return null; } })() : null;
          const lastWeight = item.lastLog?.weightUsed ? String(item.lastLog.weightUsed) : "";
          initialMap[key] = Array.from({ length: item.suggestedSets }, (_, i) => ({
            weight: lastSetCompletions?.[i]?.weight ?? lastWeight,
            reps: lastSetCompletions?.[i]?.reps ?? String(item.suggestedReps),
          }));
        }
        setActivePlan(plan);
        setSessionId(typeof sid === "number" ? sid : null);
        setSetsMap(initialMap);
      } else {
        // Multi-day plan — schedule all sessions, show summary
        const summary: Array<{ date: string; split: string }> = [];
        for (let i = 0; i < planDuration; i++) {
          const [splitType, splitVariant] = cyclePairs[i % cyclePairs.length];
          const d = new Date();
          d.setDate(d.getDate() + i);
          const scheduledDate = d.toISOString().split("T")[0];
          const plan = await generateWorkout({ splitType, splitVariant, difficultyLevel: profile.difficultyLevel, equipment, scheduledDate, clientId: selectedClientId });
          await db.workoutSessions.add({
            splitType, splitVariant, scheduledDate, isCompleted: false,
            workoutPlanJson: JSON.stringify(plan), clientId: selectedClientId, createdAt: new Date().toISOString(),
          } as WorkoutSession);
          summary.push({ date: scheduledDate, split: splitType + (splitVariant !== "Standard" ? " + Core" : "") });
        }
        setScheduledSummary(summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate workout");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSetField = useCallback((exerciseId: number, setIdx: number, field: "weight" | "reps", val: string) => {
    setSetsMap((prev) => {
      const key = String(exerciseId);
      const arr = [...(prev[key] ?? [])];
      arr[setIdx] = { ...arr[setIdx], [field]: val };
      return { ...prev, [key]: arr };
    });
  }, []);

  const handleSaveExercise = useCallback(async (exerciseId: number) => {
    if (!sessionId) return;
    const key = String(exerciseId);
    const sets = setsMap[key] ?? [];
    const logData: Omit<SessionLog, "id"> = {
      sessionId, exerciseId, sets: sets.length,
      reps: parseInt(sets[0]?.reps ?? "8") || 8,
      weightUsed: (() => { const ws = sets.map((s) => parseFloat(s.weight)).filter((w) => !isNaN(w) && w > 0); return ws.length > 0 ? ws[0] : undefined; })(),
      isCompleted: true, loggedAt: new Date().toISOString(), setCompletions: JSON.stringify(sets),
    };
    const existing = await db.sessionLogs.where("sessionId").equals(sessionId).filter((l) => l.exerciseId === exerciseId).first();
    if (existing?.id) { await db.sessionLogs.update(existing.id, logData); }
    else { await db.sessionLogs.add(logData); }
    setSavedNotifications((prev) => new Set([...prev, exerciseId]));
    setTimeout(() => { setSavedNotifications((prev) => { const next = new Set(prev); next.delete(exerciseId); return next; }); }, 2500);
  }, [sessionId, setsMap]);

  const handleComplete = async () => {
    if (!activePlan || !sessionId) return;
    await db.workoutSessions.update(sessionId, { isCompleted: true, completedAt: new Date().toISOString() });
    setIsCompleted(true);
  };

  const handleReset = () => {
    setActivePlan(null); setSessionId(null); setSetsMap({}); setIsCompleted(false);
    setError(null); setSavedNotifications(new Set()); setScheduledSummary(null);
  };

  const clientName = clients?.find((c) => c.id === selectedClientId)?.name;

  // ── Scheduled summary screen ─────────────────────────────────────────────
  if (scheduledSummary) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 16px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
            <Zap size={22} color="hsl(83 97% 59%)" fill="hsl(83 97% 59%)" />
            <span style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Generate</span>
          </div>
        </div>
        <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 16, padding: "32px 0 24px" }}>
            <CalendarCheck size={64} color="hsl(83 97% 59%)" strokeWidth={1.5} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>{scheduledSummary.length} Workouts Scheduled</div>
              {clientName && <div style={{ fontSize: 14, color: "hsl(83 97% 59%)", fontWeight: 600, marginTop: 4 }}>{clientName}</div>}
              <div style={{ fontSize: 13, color: "hsl(0 0% 50%)", marginTop: 4 }}>View them in the Workout or Schedule tab</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginBottom: 24 }}>
            {scheduledSummary.map((item, i) => {
              const d = new Date(item.date + "T12:00:00");
              const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid hsl(0 0% 15%)", background: i === 0 ? "hsl(83 97% 59% / 0.05)" : "hsl(0 0% 9%)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: i === 0 ? "hsl(83 97% 59%)" : "hsl(0 0% 18%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: i === 0 ? "hsl(0 0% 5%)" : "hsl(0 0% 60%)", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "hsl(0 0% 90%)" }}>{item.split}</div>
                    <div style={{ fontSize: 12, color: "hsl(0 0% 50%)" }}>{label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="btn-primary" onClick={handleReset}>
            <Zap size={18} /> Plan Another
          </button>
        </div>
      </div>
    );
  }

  // ── Completed screen ──────────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 32 }}>
        <CheckCircle2 size={72} color="hsl(83 97% 59%)" strokeWidth={1.5} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Workout Complete!</div>
          {clientName && <div style={{ fontSize: 14, color: "hsl(83 97% 59%)", fontWeight: 600, marginTop: 6 }}>{clientName}</div>}
        </div>
        <button className="btn-primary" onClick={handleReset} style={{ maxWidth: 280 }}>
          <Zap size={18} /> Generate Another
        </button>
      </div>
    );
  }

  // ── Active workout screen ─────────────────────────────────────────────────
  if (activePlan) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "hsl(0 0% 95%)" }}>
              {activePlan.splitType}{activePlan.splitVariant !== "Standard" && <span style={{ color: "hsl(83 97% 59%)", marginLeft: 8, fontSize: 16 }}>+ Core</span>}
            </div>
            {clientName && <div style={{ fontSize: 13, color: "hsl(83 97% 59%)", fontWeight: 600 }}>{clientName}</div>}
            <div style={{ fontSize: 12, color: "hsl(0 0% 40%)", marginTop: 2 }}>Save each exercise after entering weights</div>
          </div>
          <button className="btn-secondary" onClick={handleReset} style={{ padding: "6px 14px", fontSize: 13 }}>New</button>
        </div>

        <div className="scroll-area" style={{ flex: 1, padding: "0 16px 16px" }}>
          <div className="section-label" style={{ marginTop: 8 }}>Compound</div>
          <ExerciseBlock item={activePlan.compound} isCompound setsState={setsMap[String(activePlan.compound.exercise.id)] ?? []}
            onSetWeight={(i, v) => updateSetField(activePlan.compound.exercise.id, i, "weight", v)}
            onSetReps={(i, v) => updateSetField(activePlan.compound.exercise.id, i, "reps", v)}
            onSave={() => handleSaveExercise(activePlan.compound.exercise.id)}
            savedNotification={savedNotifications.has(activePlan.compound.exercise.id)} />

          {activePlan.compound2 && (
            <div style={{ marginTop: 8 }}>
              <ExerciseBlock item={activePlan.compound2} isCompound setsState={setsMap[String(activePlan.compound2.exercise.id)] ?? []}
                onSetWeight={(i, v) => updateSetField(activePlan.compound2!.exercise.id, i, "weight", v)}
                onSetReps={(i, v) => updateSetField(activePlan.compound2!.exercise.id, i, "reps", v)}
                onSave={() => handleSaveExercise(activePlan.compound2!.exercise.id)}
                savedNotification={savedNotifications.has(activePlan.compound2.exercise.id)} />
            </div>
          )}

          {activePlan.circuits.map((circuit, ci) => {
            const isExpanded = expandedCircuits.has(ci);
            return (
              <div key={ci} style={{ marginTop: 16 }}>
                <button type="button"
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 8 }}
                  onClick={() => setExpandedCircuits((prev) => { const next = new Set(prev); if (next.has(ci)) next.delete(ci); else next.add(ci); return next; })}>
                  <span className="section-label" style={{ margin: 0 }}>Circuit {ci + 1}</span>
                  {isExpanded ? <ChevronDown size={16} color="hsl(0 0% 50%)" /> : <ChevronRight size={16} color="hsl(0 0% 50%)" />}
                </button>
                {isExpanded && (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                    {circuit.exercises.map((item) => (
                      <ExerciseBlock key={item.exercise.id} item={item} isCompound={false}
                        setsState={setsMap[String(item.exercise.id)] ?? []}
                        onSetWeight={(i, v) => updateSetField(item.exercise.id, i, "weight", v)}
                        onSetReps={(i, v) => updateSetField(item.exercise.id, i, "reps", v)}
                        onSave={() => handleSaveExercise(item.exercise.id)}
                        savedNotification={savedNotifications.has(item.exercise.id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: 24, paddingBottom: 8 }}>
            <button className="btn-primary" onClick={handleComplete}>
              <CheckCircle2 size={18} /> Complete Workout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Setup screen ──────────────────────────────────────────────────────────
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

        {/* Client dropdown */}
        <div className="section-label" style={{ marginTop: 16 }}>Client</div>
        <div style={{ position: "relative" }}>
          <select
            value={selectedClientId ?? ""}
            onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : undefined)}
            style={{
              width: "100%", height: 48, borderRadius: 12,
              border: `1px solid ${selectedClientId !== undefined ? "hsl(83 97% 59% / 0.5)" : "hsl(0 0% 18%)"}`,
              background: selectedClientId !== undefined ? "hsl(83 97% 59% / 0.06)" : "hsl(0 0% 9%)",
              color: "hsl(0 0% 90%)", padding: "0 40px 0 14px", fontSize: 15, fontFamily: "inherit",
              fontWeight: 500, appearance: "none" as any, cursor: "pointer",
            }}
          >
            <option value="">No client (general)</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={16} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "hsl(0 0% 45%)", pointerEvents: "none" }} />
        </div>
        {clients && clients.length === 0 && (
          <div style={{ fontSize: 12, color: "hsl(0 0% 40%)", marginTop: 6 }}>Add clients in the Clientele tab</div>
        )}

        {/* Plan Duration */}
        <div className="section-label" style={{ marginTop: 20 }}>Plan Duration</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={() => setPlanDuration((p) => Math.max(1, p - 1))}
            style={{ width: 40, height: 40, borderRadius: 10, background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 18%)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}>
            <Minus size={16} />
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: planDuration > 1 ? "hsl(83 97% 59%)" : "hsl(0 0% 95%)" }}>{planDuration}</div>
            <div style={{ fontSize: 12, color: "hsl(0 0% 45%)" }}>{planDuration === 1 ? "single workout" : `days — schedules ${planDuration} workouts`}</div>
          </div>
          <button type="button" onClick={() => setPlanDuration((p) => Math.min(14, p + 1))}
            style={{ width: 40, height: 40, borderRadius: 10, background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 18%)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}>
            <Plus size={16} />
          </button>
        </div>
        {planDuration > 1 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "hsl(0 0% 45%)", textAlign: "center" }}>
            Workouts will be scheduled from today through day {planDuration}
          </div>
        )}

        {/* Equipment */}
        <div className="section-label" style={{ marginTop: 20 }}>Equipment</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {EQUIPMENT_OPTIONS.map((eq) => (
            <button key={eq} type="button" className={`chip${equipment.includes(eq) ? " active" : ""}`} onClick={() => toggleEquipment(eq)}>
              {eq}
            </button>
          ))}
        </div>

        {/* Workout Split */}
        <div className="section-label" style={{ marginTop: 20 }}>Workout Split</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          {Object.keys(SPLIT_CYCLES).map((key) => {
            const isActive = splitCycleKey === key;
            return (
              <button key={key} type="button" onClick={() => setSplitCycleKey(key)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, border: `2px solid ${isActive ? "hsl(83 97% 59%)" : "hsl(0 0% 15%)"}`, background: isActive ? "hsl(83 97% 59% / 0.08)" : "hsl(0 0% 9%)", cursor: "pointer", transition: "all 0.15s" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: isActive ? "hsl(83 97% 59%)" : "hsl(0 0% 85%)" }}>{key}</span>
                <span style={{ fontSize: 12, color: "hsl(0 0% 45%)" }}>{SPLIT_CYCLES[key].length} day{SPLIT_CYCLES[key].length > 1 ? "s" : ""}</span>
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
          <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating || equipment.length === 0}>
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : planDuration > 1 ? <CalendarCheck size={18} /> : <Zap size={18} />}
            {isGenerating ? (planDuration > 1 ? "Scheduling…" : "Generating…") : planDuration > 1 ? `Schedule ${planDuration} Workouts` : "Generate Workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
