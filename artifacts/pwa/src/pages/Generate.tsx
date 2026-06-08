import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Zap, CheckCircle2, ChevronRight, ChevronDown, Loader2, Save, Check, Minus, Plus, CalendarCheck, ChevronLeft, RefreshCw } from "lucide-react";
import { db } from "../db/index";
import { generateWorkout, SPLIT_CYCLES } from "../lib/workoutGenerator";
import type { WorkoutPlan, WorkoutSession, ExerciseWithHistory, SessionLog } from "../lib/types";

const EQUIPMENT_OPTIONS = ["Full Gym", "Bodyweight", "Dumbbells"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type Step = "config" | "calendar" | "workout" | "scheduled";

interface SetState { weight: string; reps: string; }
type SetsMap = Record<string, SetState[]>;

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

function ExerciseBlock({ item, isCompound, setsState, onSetWeight, onSetReps, onSave, savedNotification }: {
  item: ExerciseWithHistory; isCompound: boolean; setsState: SetState[];
  onSetWeight: (idx: number, val: string) => void; onSetReps: (idx: number, val: string) => void;
  onSave: () => void; savedNotification: boolean;
}) {
  const muscleTags = getMuscleLabels(item.exercise);
  const lastW = item.lastLog?.weightUsed;
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
        {lastW && (
          <div style={{ fontSize: 11, color: "hsl(83 97% 59%)", fontWeight: 600, background: "hsl(83 97% 59% / 0.1)", padding: "4px 8px", borderRadius: 8, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
            Last: {lastW} lbs
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {setsState.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: "hsl(0 0% 17%)", color: "hsl(0 0% 55%)", flexShrink: 0 }}>{i + 1}</div>
            <input className="weight-input" type="number" placeholder="lbs" value={s.weight} onChange={(e) => onSetWeight(i, e.target.value)} inputMode="decimal" />
            <span style={{ color: "hsl(0 0% 45%)", fontSize: 13 }}>×</span>
            <input className="weight-input" type="number" placeholder={String(item.suggestedReps)} value={s.reps} onChange={(e) => onSetReps(i, e.target.value)} inputMode="numeric" style={{ width: 60 }} />
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
  const sessions = useLiveQuery(() => db.workoutSessions.toArray(), []);

  const [step, setStep] = useState<Step>("config");
  const [equipment, setEquipment] = useState<string[]>(["Full Gym", "Bodyweight", "Dumbbells"]);
  const [splitCycleKey, setSplitCycleKey] = useState("Full Body");
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [planDuration, setPlanDuration] = useState(1);

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Workout logging state
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [setsMap, setSetsMap] = useState<SetsMap>({});
  const [savedNotifications, setSavedNotifications] = useState<Set<number>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);
  const [expandedCircuits, setExpandedCircuits] = useState<Set<number>>(new Set([0, 1, 2]));
  const [scheduledSummary, setScheduledSummary] = useState<Array<{ date: string; split: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setEquipment(profile.equipment ?? ["Full Gym", "Bodyweight", "Dumbbells"]);
      setSplitCycleKey(profile.preferredSplit ?? "Full Body");
    }
  }, [profile?.id]);

  const toggleEquipment = (item: string) =>
    setEquipment((prev) => prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]);

  // Calendar helpers
  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const firstDay = new Date(calYear, calMonthIdx, 1).getDay();
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const today = new Date().toISOString().split("T")[0];

  const scheduledDates = new Set((sessions ?? []).map((s) => s.scheduledDate).filter(Boolean) as string[]);

  const handleDateToggle = (dateStr: string) => {
    setSelectedDates((prev) => {
      if (prev.includes(dateStr)) return prev.filter((d) => d !== dateStr);
      if (prev.length >= planDuration) return prev; // at max
      return [...prev, dateStr].sort();
    });
  };

  const handleConfirmDates = async () => {
    if (selectedDates.length === 0) return;
    setIsGenerating(true);
    setError(null);
    const difficultyLevel = profile?.difficultyLevel ?? "Intermediate";
    try {
      const cyclePairs = SPLIT_CYCLES[splitCycleKey] ?? [["Full Body", "Standard"]];
      const summary: Array<{ date: string; split: string }> = [];

      for (let i = 0; i < selectedDates.length; i++) {
        const scheduledDate = selectedDates[i];
        const [splitType, splitVariant] = cyclePairs[i % cyclePairs.length];

        // Remove any existing session on this date (for selected client or general)
        const existing = (sessions ?? []).filter((s) => {
          if (s.scheduledDate !== scheduledDate) return false;
          if (selectedClientId !== undefined) return s.clientId === selectedClientId;
          return !s.clientId;
        });
        for (const s of existing) {
          if (s.id) {
            await db.sessionLogs.where("sessionId").equals(s.id).delete();
            await db.workoutSessions.delete(s.id);
          }
        }

        const plan = await generateWorkout({
          splitType, splitVariant,
          difficultyLevel,
          equipment,
          scheduledDate,
          clientId: selectedClientId,
        });
        const sid = await db.workoutSessions.add({
          splitType, splitVariant, scheduledDate, isCompleted: false,
          workoutPlanJson: JSON.stringify(plan),
          clientId: selectedClientId,
          createdAt: new Date().toISOString(),
        } as WorkoutSession);

        summary.push({ date: scheduledDate, split: splitType + (splitVariant !== "Standard" ? " + Core" : "") });

        // If single day and it's today, go directly to logging
        if (selectedDates.length === 1 && scheduledDate === today) {
          const allItems: ExerciseWithHistory[] = [plan.compound, ...(plan.compound2 ? [plan.compound2] : []), ...plan.circuits.flatMap((c) => c.exercises)];
          const initialMap: SetsMap = {};
          for (const item of allItems) {
            const key = String(item.exercise.id);
            const lastW = item.lastLog?.weightUsed ? String(item.lastLog.weightUsed) : "";
            initialMap[key] = Array.from({ length: item.suggestedSets }, () => ({ weight: lastW, reps: String(item.suggestedReps) }));
          }
          setActivePlan(plan);
          setSessionId(typeof sid === "number" ? sid : null);
          setSetsMap(initialMap);
          setStep("workout");
          return;
        }
      }

      setScheduledSummary(summary);
      setStep("scheduled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
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
    const sets = setsMap[String(exerciseId)] ?? [];
    const weights = sets.map((s) => parseFloat(s.weight)).filter((w) => !isNaN(w) && w > 0);
    const logData: Omit<SessionLog, "id"> = {
      sessionId, exerciseId, sets: sets.length,
      reps: parseInt(sets[0]?.reps ?? "8") || 8,
      weightUsed: weights.length > 0 ? weights[0] : undefined,
      isCompleted: true,
      loggedAt: new Date().toISOString(),
      setCompletions: JSON.stringify(sets),
    };
    const existing = await db.sessionLogs.where("sessionId").equals(sessionId).filter((l) => l.exerciseId === exerciseId).first();
    if (existing?.id) await db.sessionLogs.update(existing.id, logData);
    else await db.sessionLogs.add(logData);
    setSavedNotifications((prev) => new Set([...prev, exerciseId]));
    setTimeout(() => { setSavedNotifications((prev) => { const n = new Set(prev); n.delete(exerciseId); return n; }); }, 2500);
  }, [sessionId, setsMap]);

  const handleComplete = async () => {
    if (!activePlan || !sessionId) return;
    await db.workoutSessions.update(sessionId, { isCompleted: true, completedAt: new Date().toISOString() });
    setIsCompleted(true);
  };

  const reset = () => {
    setStep("config"); setActivePlan(null); setSessionId(null); setSetsMap({});
    setIsCompleted(false); setError(null); setSavedNotifications(new Set());
    setScheduledSummary([]); setSelectedDates([]);
  };

  const clientName = clients?.find((c) => c.id === selectedClientId)?.name;

  const hasExisting = scheduledDates.size > 0;

  // ── Scheduled summary ────────────────────────────────────────────────────
  if (step === "scheduled") {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 16px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Zap size={22} color="hsl(83 97% 59%)" fill="hsl(83 97% 59%)" />
            <span style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Generate</span>
          </div>
        </div>
        <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 12, padding: "28px 0 20px" }}>
            <CalendarCheck size={60} color="hsl(83 97% 59%)" strokeWidth={1.5} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>{scheduledSummary.length} Workout{scheduledSummary.length > 1 ? "s" : ""} Scheduled</div>
              {clientName && <div style={{ fontSize: 14, color: "hsl(83 97% 59%)", fontWeight: 600, marginTop: 4 }}>{clientName}</div>}
              <div style={{ fontSize: 13, color: "hsl(0 0% 50%)", marginTop: 4 }}>View them in the Workout or Schedule tab</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginBottom: 24 }}>
            {scheduledSummary.map((item, i) => {
              const d = new Date(item.date + "T12:00:00");
              const label = item.date === today ? "Today" : item.date === new Date(Date.now() + 86400000).toISOString().split("T")[0] ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid hsl(0 0% 15%)", background: item.date === today ? "hsl(83 97% 59% / 0.05)" : "hsl(0 0% 9%)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: item.date === today ? "hsl(83 97% 59%)" : "hsl(0 0% 18%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: item.date === today ? "hsl(0 0% 5%)" : "hsl(0 0% 60%)", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "hsl(0 0% 90%)" }}>{item.split}</div>
                    <div style={{ fontSize: 12, color: "hsl(0 0% 50%)" }}>{label}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn-primary" onClick={reset}><Zap size={18} /> Plan Another</button>
        </div>
      </div>
    );
  }

  // ── Completed screen ──────────────────────────────────────────────────────
  if (step === "workout" && isCompleted) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 32 }}>
        <CheckCircle2 size={72} color="hsl(83 97% 59%)" strokeWidth={1.5} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Workout Complete!</div>
          {clientName && <div style={{ fontSize: 14, color: "hsl(83 97% 59%)", fontWeight: 600, marginTop: 6 }}>{clientName}</div>}
        </div>
        <button className="btn-primary" onClick={reset} style={{ maxWidth: 280 }}><Zap size={18} /> Generate Another</button>
      </div>
    );
  }

  // ── Active workout logging ─────────────────────────────────────────────────
  if (step === "workout" && activePlan) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "hsl(0 0% 95%)" }}>
              {activePlan.splitType}{activePlan.splitVariant !== "Standard" && <span style={{ color: "hsl(83 97% 59%)", fontSize: 15 }}> + Core</span>}
            </div>
            {clientName && <div style={{ fontSize: 12, color: "hsl(83 97% 59%)", fontWeight: 600 }}>{clientName}</div>}
          </div>
          <button className="btn-secondary" onClick={reset} style={{ padding: "6px 14px", fontSize: 13 }}>New</button>
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
                  onClick={() => setExpandedCircuits((prev) => { const n = new Set(prev); if (n.has(ci)) n.delete(ci); else n.add(ci); return n; })}>
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
            <button className="btn-primary" onClick={handleComplete}><CheckCircle2 size={18} /> Complete Workout</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Calendar date picker ─────────────────────────────────────────────────
  if (step === "calendar") {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid hsl(0 0% 12%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <button type="button" onClick={() => setStep("config")}
              style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(0 0% 13%)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}>
              <ChevronLeft size={18} />
            </button>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Pick Days</div>
              <div style={{ fontSize: 12, color: "hsl(0 0% 45%)" }}>
                Select {planDuration} day{planDuration > 1 ? "s" : ""} for your workouts
                {selectedDates.length > 0 && <span style={{ color: "hsl(83 97% 59%)", marginLeft: 6 }}>· {selectedDates.length}/{planDuration} selected</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="scroll-area" style={{ flex: 1, padding: "12px 16px 24px" }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))} style={{ width: 38, height: 38, padding: 0, borderRadius: 10 }}>
              <ChevronLeft size={17} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: "hsl(0 0% 90%)" }}>{MONTH_NAMES[calMonthIdx]} {calYear}</span>
            <button type="button" className="btn-secondary" onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))} style={{ width: 38, height: 38, padding: 0, borderRadius: 10 }}>
              <ChevronRight size={17} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {DAY_NAMES.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "hsl(0 0% 45%)", padding: "3px 0" }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 20 }}>
            {Array.from({ length: totalCells }, (_, i) => {
              const isCurrentMonth = i >= firstDay && i < firstDay + daysInMonth;
              const day = isCurrentMonth ? i - firstDay + 1 : 0;
              const dateStr = isCurrentMonth
                ? `${calYear}-${String(calMonthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                : "";
              const isSelected = selectedDates.includes(dateStr);
              const isToday = dateStr === today;
              const hasExisting = scheduledDates.has(dateStr);
              const selectionOrder = selectedDates.indexOf(dateStr);
              const atMax = selectedDates.length >= planDuration;

              return (
                <button key={i} type="button"
                  disabled={!isCurrentMonth || (atMax && !isSelected)}
                  onClick={() => isCurrentMonth && handleDateToggle(dateStr)}
                  style={{
                    display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
                    borderRadius: 10, minHeight: 50, gap: 2,
                    border: isSelected ? "2px solid hsl(83 97% 59%)" : isToday ? "2px solid hsl(83 97% 59% / 0.4)" : "2px solid transparent",
                    background: isSelected ? "hsl(83 97% 59%)" : "hsl(0 0% 9%)",
                    cursor: isCurrentMonth && (!atMax || isSelected) ? "pointer" : "default",
                    opacity: isCurrentMonth ? (atMax && !isSelected ? 0.35 : 1) : 0.2,
                    position: "relative" as const,
                  }}>
                  {isCurrentMonth && (
                    <>
                      {selectionOrder >= 0 && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: "hsl(0 0% 5%)", lineHeight: 1 }}>{selectionOrder + 1}</span>
                      )}
                      <span style={{ fontSize: 14, fontWeight: isToday ? 800 : 500, color: isSelected ? "hsl(0 0% 5%)" : isToday ? "hsl(83 97% 59%)" : "hsl(0 0% 80%)" }}>
                        {day}
                      </span>
                      {hasExisting && !isSelected && <div style={{ width: 4, height: 4, borderRadius: 999, background: "hsl(38 95% 60%)" }} />}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {hasExisting && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "hsl(38 95% 60%)", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: "hsl(38 95% 60%)", flexShrink: 0 }} />
              Orange dot = existing workout (will be replaced)
            </div>
          )}

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "hsl(0 72% 51% / 0.12)", color: "hsl(0 72% 65%)", fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <button className="btn-primary"
            onClick={handleConfirmDates}
            disabled={selectedDates.length === 0 || isGenerating}>
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <CalendarCheck size={18} />}
            {isGenerating ? "Generating…" : `Confirm ${selectedDates.length} Day${selectedDates.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    );
  }

  // ── Config screen ─────────────────────────────────────────────────────────
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
        <div className="section-label" style={{ marginTop: 12 }}>Client</div>
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
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown size={16} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "hsl(0 0% 45%)", pointerEvents: "none" }} />
        </div>

        {/* Plan Duration */}
        <div className="section-label" style={{ marginTop: 20 }}>Plan Duration</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={() => setPlanDuration((p) => Math.max(1, p - 1))}
            style={{ width: 40, height: 40, borderRadius: 10, background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 18%)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}>
            <Minus size={16} />
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: planDuration > 1 ? "hsl(83 97% 59%)" : "hsl(0 0% 95%)" }}>{planDuration}</div>
            <div style={{ fontSize: 12, color: "hsl(0 0% 45%)" }}>{planDuration === 1 ? "single workout" : `workouts over ${planDuration} days`}</div>
          </div>
          <button type="button" onClick={() => setPlanDuration((p) => Math.min(14, p + 1))}
            style={{ width: 40, height: 40, borderRadius: 10, background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 18%)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}>
            <Plus size={16} />
          </button>
        </div>

        {/* Equipment */}
        <div className="section-label" style={{ marginTop: 20 }}>Equipment</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {EQUIPMENT_OPTIONS.map((eq) => (
            <button key={eq} type="button" className={`chip${equipment.includes(eq) ? " active" : ""}`} onClick={() => toggleEquipment(eq)}>{eq}</button>
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

        <div style={{ marginTop: 24 }}>
          <button className="btn-primary"
            onClick={() => { setSelectedDates([]); setStep("calendar"); }}
            disabled={equipment.length === 0}>
            {planDuration > 1 ? <CalendarCheck size={18} /> : <Zap size={18} />}
            {planDuration > 1 ? `Pick ${planDuration} Days` : "Pick a Day"}
          </button>
        </div>
      </div>
    </div>
  );
}
