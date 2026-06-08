import { useState, useEffect, useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, CheckCircle2, Dumbbell, RefreshCw, Save, Check, History, Star, Pencil, Search, X } from "lucide-react";
import { db } from "../db/index";
import type { WorkoutPlan, ExerciseWithHistory, SessionLog, Exercise } from "../lib/types";
import { pickAlternativeExercise, getLastLog } from "../lib/workoutGenerator";

interface Props {
  sessionId: number;
  onBack: () => void;
  onOpenHistory: () => void;
}

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

function getAllItems(plan: WorkoutPlan): ExerciseWithHistory[] {
  return [plan.compound, ...(plan.compound2 ? [plan.compound2] : []), ...plan.circuits.flatMap((c) => c.exercises)];
}

function replacePlanExercise(plan: WorkoutPlan, oldId: number, newItem: ExerciseWithHistory): WorkoutPlan {
  if (plan.compound.exercise.id === oldId) return { ...plan, compound: newItem };
  if (plan.compound2?.exercise.id === oldId) return { ...plan, compound2: newItem };
  return { ...plan, circuits: plan.circuits.map((c) => ({ ...c, exercises: c.exercises.map((e) => e.exercise.id === oldId ? newItem : e) })) };
}

function StarRating({ value, onChange }: { value: number; onChange: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button"
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(value === s ? 0 : s)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
          <Star size={15}
            fill={(hover || value) >= s ? "hsl(43 96% 56%)" : "none"}
            color={(hover || value) >= s ? "hsl(43 96% 56%)" : "hsl(0 0% 35%)"}
            strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

function ExerciseBlock({ item, isCompound, sets, onSetWeight, onSetReps, onSave, onRandomize, onSwap, savedNotification, isRandomizing, rating, onRate }: {
  item: ExerciseWithHistory; isCompound: boolean; sets: SetState[];
  onSetWeight: (idx: number, val: string) => void; onSetReps: (idx: number, val: string) => void;
  onSave: () => void; onRandomize: () => void; onSwap: () => void;
  savedNotification: boolean; isRandomizing: boolean;
  rating: number; onRate: (r: number) => void;
}) {
  const muscleTags = getMuscleLabels(item.exercise);
  const lastW = item.lastLog?.weightUsed;

  return (
    <div className="exercise-card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          {isCompound && (
            <span style={{ background: "hsl(83 97% 59% / 0.18)", color: "hsl(83 97% 59%)", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, letterSpacing: "0.06em", textTransform: "uppercase" as const, display: "inline-block", marginBottom: 4 }}>
              Compound
            </span>
          )}
          <div className="exercise-name" style={{ fontSize: 15 }}>{item.exercise.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginTop: 4 }}>
            {muscleTags.map((t) => <span key={t} className="muscle-tag">{t}</span>)}
            <span style={{ fontSize: 11, color: "hsl(0 0% 45%)" }}>{item.exercise.equipment}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 5, alignItems: "flex-end", flexShrink: 0 }}>
          {lastW && (
            <div style={{ fontSize: 11, color: "hsl(83 97% 59%)", fontWeight: 600, background: "hsl(83 97% 59% / 0.1)", padding: "3px 7px", borderRadius: 7, whiteSpace: "nowrap" as const }}>
              Last: {lastW} lbs
            </div>
          )}
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" onClick={onSwap}
              style={{ width: 30, height: 30, borderRadius: 7, background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 18%)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 55%)" }}
              title="Change exercise">
              <Pencil size={12} />
            </button>
            <button type="button" onClick={onRandomize} disabled={isRandomizing}
              style={{ width: 30, height: 30, borderRadius: 7, background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 18%)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 55%)" }}
              title="Randomize">
              <RefreshCw size={12} style={{ animation: isRandomizing ? "spin 0.6s linear infinite" : "none" }} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 7 }}>
        {sets.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 999, background: "hsl(0 0% 16%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "hsl(0 0% 55%)", flexShrink: 0 }}>{i + 1}</div>
            <input className="weight-input" type="number" placeholder="lbs" value={s.weight} onChange={(e) => onSetWeight(i, e.target.value)} inputMode="decimal" />
            <span style={{ color: "hsl(0 0% 45%)", fontSize: 13 }}>×</span>
            <input className="weight-input" type="number" placeholder={String(item.suggestedReps)} value={s.reps} onChange={(e) => onSetReps(i, e.target.value)} inputMode="numeric" style={{ width: 60 }} />
            <span style={{ color: "hsl(0 0% 45%)", fontSize: 12 }}>reps</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "hsl(0 0% 45%)" }}>Rate:</span>
          <StarRating value={rating} onChange={onRate} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {savedNotification && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(83 97% 59%)", display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={13} /> Saved
            </span>
          )}
          <button type="button" className="btn-secondary" onClick={onSave} style={{ height: 32, padding: "0 12px", fontSize: 12 }}>
            <Save size={12} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ExerciseSwapOverlay({ currentId, allExercises, onSelect, onClose }: {
  currentId: number; allExercises: Exercise[];
  onSelect: (ex: Exercise) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const lower = q.toLowerCase().trim();
    return allExercises
      .filter((e) => e.isActive !== false && e.id !== currentId && (!lower || e.name.toLowerCase().includes(lower)))
      .slice(0, 40);
  }, [q, allExercises, currentId]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column" as const }}>
      <div style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.7)" }} onClick={onClose} />
      <div style={{ position: "relative", margin: "auto 0 0", background: "hsl(0 0% 7%)", borderRadius: "20px 20px 0 0", maxHeight: "70vh", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid hsl(0 0% 13%)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(0 0% 90%)", marginBottom: 10 }}>Change Exercise</div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "hsl(0 0% 40%)" }} />
            <input autoFocus type="text" placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)}
              style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 12%)", color: "hsl(0 0% 90%)", padding: "0 36px", fontSize: 13, fontFamily: "inherit" }} />
            {q && <button type="button" onClick={() => setQ("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "hsl(0 0% 40%)" }}><X size={14} /></button>}
          </div>
        </div>
        <div style={{ overflowY: "auto" as const, flex: 1, padding: "8px 12px 20px" }}>
          {filtered.map((ex) => {
            const muscles = [ex.hitChest && "Chest", ex.hitBack && "Back", ex.hitLegs && "Legs", ex.hitCore && "Core", ex.hitArm && "Arms", ex.hitShoulder && "Shoulders"].filter(Boolean).slice(0, 3) as string[];
            return (
              <button key={ex.id} type="button" onClick={() => onSelect(ex)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10, background: "none", border: "1px solid hsl(0 0% 13%)", cursor: "pointer", textAlign: "left" as const, marginBottom: 5 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0 0% 88%)" }}>{ex.name}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" as const }}>
                    {muscles.map((m) => <span key={m} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "hsl(83 97% 59% / 0.1)", color: "hsl(83 97% 59%)" }}>{m}</span>)}
                    <span style={{ fontSize: 10, color: "hsl(0 0% 40%)" }}>{ex.equipment}</span>
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <div style={{ textAlign: "center", color: "hsl(0 0% 40%)", fontSize: 13, padding: "24px 0" }}>No exercises found</div>}
        </div>
      </div>
    </div>
  );
}

export default function WorkoutDetail({ sessionId, onBack, onOpenHistory }: Props) {
  const session = useLiveQuery(() => db.workoutSessions.get(sessionId), [sessionId]);
  const client = useLiveQuery(async () => {
    if (!session?.clientId) return undefined;
    return db.clients.get(session.clientId);
  }, [session?.clientId]);
  const allExercises = useLiveQuery(() => db.exercises.toArray().then((a) => a.sort((x, y) => x.name.localeCompare(y.name))), []);

  const [localPlan, setLocalPlan] = useState<WorkoutPlan | null>(null);
  const [setsMap, setSetsMap] = useState<SetsMap>({});
  const [ratingsMap, setRatingsMap] = useState<Record<string, number>>({});
  const [savedNotifications, setSavedNotifications] = useState<Set<number>>(new Set());
  const [isRandomizing, setIsRandomizing] = useState<number | null>(null);
  const [swapExerciseId, setSwapExerciseId] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Session-level metrics
  const [bodyWeight, setBodyWeight] = useState("");
  const [energyLevel, setEnergyLevel] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [metricsSaved, setMetricsSaved] = useState(false);

  // Initialize plan + setsMap + metrics from saved session (once)
  useEffect(() => {
    if (!session || isInitialized) return;
    setBodyWeight(session.bodyWeight ? String(session.bodyWeight) : "");
    setEnergyLevel(session.energyLevel ? String(session.energyLevel) : "");
    setSessionNotes(session.sessionNotes ?? "");

    if (!session.workoutPlanJson) { setIsInitialized(true); return; }
    let plan: WorkoutPlan;
    try { plan = JSON.parse(session.workoutPlanJson); } catch { setIsInitialized(true); return; }
    setLocalPlan(plan);

    db.sessionLogs.where("sessionId").equals(sessionId).toArray().then((savedLogs) => {
      const allItems = getAllItems(plan);
      const map: SetsMap = {};
      const ratings: Record<string, number> = {};
      for (const item of allItems) {
        const key = String(item.exercise.id);
        const existing = savedLogs.find((l) => l.exerciseId === item.exercise.id);
        if (existing?.setCompletions) { try { map[key] = JSON.parse(existing.setCompletions); } catch {} }
        if (existing?.rating) ratings[key] = existing.rating;
        if (!map[key]) {
          const lastW = item.lastLog?.weightUsed ? String(item.lastLog.weightUsed) : "";
          map[key] = Array.from({ length: item.suggestedSets }, () => ({ weight: lastW, reps: String(item.suggestedReps) }));
        }
      }
      setSetsMap(map);
      setRatingsMap(ratings);
      setIsInitialized(true);
    });
  }, [session, sessionId, isInitialized]);

  const saveMetrics = useCallback(async () => {
    if (!session?.id) return;
    const bw = parseFloat(bodyWeight);
    const el = parseInt(energyLevel);
    await db.workoutSessions.update(session.id, {
      bodyWeight: !isNaN(bw) && bw > 0 ? bw : undefined,
      energyLevel: !isNaN(el) && el >= 1 && el <= 5 ? el : undefined,
      sessionNotes: sessionNotes.trim() || undefined,
    });
    setMetricsSaved(true);
    setTimeout(() => setMetricsSaved(false), 2000);
  }, [session?.id, bodyWeight, energyLevel, sessionNotes]);

  const updateSet = useCallback((exerciseId: number, idx: number, field: "weight" | "reps", val: string) => {
    setSetsMap((prev) => {
      const key = String(exerciseId);
      const arr = [...(prev[key] ?? [])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...prev, [key]: arr };
    });
  }, []);

  const handleSave = useCallback(async (exerciseId: number) => {
    if (!session?.id) return;
    const sets = setsMap[String(exerciseId)] ?? [];
    const weights = sets.map((s) => parseFloat(s.weight)).filter((w) => !isNaN(w) && w > 0);
    const logData: Omit<SessionLog, "id"> = {
      sessionId: session.id, exerciseId,
      sets: sets.length, reps: parseInt(sets[0]?.reps ?? "8") || 8,
      weightUsed: weights.length > 0 ? weights[0] : undefined,
      isCompleted: true, loggedAt: new Date().toISOString(),
      setCompletions: JSON.stringify(sets),
      rating: ratingsMap[String(exerciseId)] || undefined,
    };
    const existing = await db.sessionLogs.where("sessionId").equals(session.id).filter((l) => l.exerciseId === exerciseId).first();
    if (existing?.id) await db.sessionLogs.update(existing.id, logData);
    else await db.sessionLogs.add(logData);
    setSavedNotifications((prev) => new Set([...prev, exerciseId]));
    setTimeout(() => { setSavedNotifications((prev) => { const n = new Set(prev); n.delete(exerciseId); return n; }); }, 2500);
  }, [session?.id, setsMap, ratingsMap]);

  const handleRandomize = useCallback(async (exerciseId: number) => {
    if (!localPlan || !session?.id) return;
    setIsRandomizing(exerciseId);
    try {
      const profile = await db.userProfile.toCollection().first();
      const allCurrentIds = getAllItems(localPlan).map((i) => i.exercise.id);
      const original = getAllItems(localPlan).find((i) => i.exercise.id === exerciseId)?.exercise;
      if (!original) return;
      const newEx = await pickAlternativeExercise(original, profile?.difficultyLevel ?? "Intermediate", profile?.equipment ?? [], allCurrentIds);
      if (!newEx) return;
      const lastLog = await getLastLog(newEx.id, session.clientId);
      const isCmpl = localPlan.compound.exercise.id === exerciseId || localPlan.compound2?.exercise.id === exerciseId;
      const newItem: ExerciseWithHistory = { exercise: newEx, lastLog, suggestedSets: isCmpl ? 4 : 3, suggestedReps: 8 };
      const updatedPlan = replacePlanExercise(localPlan, exerciseId, newItem);
      setLocalPlan(updatedPlan);
      await db.workoutSessions.update(session.id, { workoutPlanJson: JSON.stringify(updatedPlan) });
      const lastW = lastLog?.weightUsed ? String(lastLog.weightUsed) : "";
      setSetsMap((prev) => ({ ...prev, [String(newEx.id)]: Array.from({ length: newItem.suggestedSets }, () => ({ weight: lastW, reps: "8" })) }));
    } finally { setIsRandomizing(null); }
  }, [localPlan, session]);

  const handleSwap = useCallback(async (oldId: number, newEx: Exercise) => {
    if (!localPlan || !session?.id) return;
    const lastLog = await getLastLog(newEx.id, session.clientId);
    const isCmpl = localPlan.compound.exercise.id === oldId || localPlan.compound2?.exercise.id === oldId;
    const newItem: ExerciseWithHistory = { exercise: newEx, lastLog, suggestedSets: isCmpl ? 4 : 3, suggestedReps: 8 };
    const updatedPlan = replacePlanExercise(localPlan, oldId, newItem);
    setLocalPlan(updatedPlan);
    await db.workoutSessions.update(session.id, { workoutPlanJson: JSON.stringify(updatedPlan) });
    const lastW = lastLog?.weightUsed ? String(lastLog.weightUsed) : "";
    setSetsMap((prev) => ({ ...prev, [String(newEx.id)]: Array.from({ length: newItem.suggestedSets }, () => ({ weight: lastW, reps: "8" })) }));
    setSwapExerciseId(null);
  }, [localPlan, session]);

  const handleMarkComplete = async () => {
    if (!session?.id) return;
    await db.workoutSessions.update(session.id, { isCompleted: true, completedAt: new Date().toISOString() });
  };

  if (!session) {
    return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 50%)" }}>Loading…</div>;
  }

  const scheduledDate = session.scheduledDate
    ? new Date(session.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : new Date(session.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const energyLabels: Record<string, string> = { "1": "1 — Very Low", "2": "2 — Low", "3": "3 — Moderate", "4": "4 — High", "5": "5 — Very High" };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" as const }}>
      {/* Swap overlay */}
      {swapExerciseId !== null && allExercises && (
        <ExerciseSwapOverlay
          currentId={swapExerciseId}
          allExercises={allExercises}
          onSelect={(ex) => handleSwap(swapExerciseId, ex)}
          onClose={() => setSwapExerciseId(null)}
        />
      )}

      {/* Header */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid hsl(0 0% 12%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={onBack} style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(0 0% 13%)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: "hsl(0 0% 95%)" }}>
                {session.splitType}{session.splitVariant !== "Standard" && <span style={{ color: "hsl(83 97% 59%)", fontSize: 15 }}> + Core</span>}
              </span>
              {session.isCompleted && <CheckCircle2 size={17} color="hsl(83 97% 59%)" />}
            </div>
            <div style={{ fontSize: 12, color: "hsl(0 0% 48%)", marginTop: 1 }}>
              {scheduledDate}
              {client && <span style={{ color: "hsl(83 97% 59%)", marginLeft: 8, fontWeight: 600 }}>· {client.name}</span>}
            </div>
          </div>
          <button type="button" onClick={onOpenHistory} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 20%)", cursor: "pointer", color: "hsl(0 0% 65%)", fontSize: 12, fontWeight: 600, fontFamily: "inherit", flexShrink: 0 }}>
            <History size={14} /> History
          </button>
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "12px 16px 24px" }}>
        {/* Session metrics */}
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, border: "1px solid hsl(0 0% 15%)", background: "hsl(0 0% 8%)" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(0 0% 50%)", marginBottom: 5 }}>BODY WEIGHT (lbs)</div>
              <input type="number" placeholder="e.g. 185" value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} onBlur={saveMetrics} inputMode="decimal"
                style={{ width: "100%", height: 40, borderRadius: 9, border: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 12%)", color: "hsl(0 0% 92%)", padding: "0 10px", fontSize: 14, fontFamily: "inherit", textAlign: "center" as const }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(0 0% 50%)", marginBottom: 5 }}>ENERGY LEVEL</div>
              <select value={energyLevel} onChange={(e) => { setEnergyLevel(e.target.value); setTimeout(saveMetrics, 0); }}
                style={{ width: "100%", height: 40, borderRadius: 9, border: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 12%)", color: energyLevel ? "hsl(0 0% 90%)" : "hsl(0 0% 45%)", padding: "0 8px", fontSize: 13, fontFamily: "inherit", appearance: "none" as any }}>
                <option value="">Select…</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{energyLabels[String(n)]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(0 0% 50%)", marginBottom: 5 }}>SESSION NOTES</div>
            <textarea placeholder="How did this session feel? Any notes…" value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)} onBlur={saveMetrics}
              style={{ width: "100%", minHeight: 64, borderRadius: 9, border: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 12%)", color: "hsl(0 0% 88%)", padding: "8px 10px", fontSize: 13, fontFamily: "inherit", resize: "vertical" as const, lineHeight: 1.5 }} />
          </div>
          {metricsSaved && <div style={{ fontSize: 11, color: "hsl(83 97% 59%)", textAlign: "right" as const, marginTop: 4 }}>✓ Saved</div>}
        </div>

        {!localPlan ? (
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 12, color: "hsl(0 0% 40%)", textAlign: "center" }}>
            <Dumbbell size={48} strokeWidth={1} />
            <div style={{ fontSize: 15, color: "hsl(0 0% 50%)" }}>No workout plan available</div>
          </div>
        ) : (
          <>
            <div className="section-label">Compound</div>
            <ExerciseBlock item={localPlan.compound} isCompound sets={setsMap[String(localPlan.compound.exercise.id)] ?? []}
              onSetWeight={(i, v) => updateSet(localPlan.compound.exercise.id, i, "weight", v)}
              onSetReps={(i, v) => updateSet(localPlan.compound.exercise.id, i, "reps", v)}
              onSave={() => handleSave(localPlan.compound.exercise.id)}
              onRandomize={() => handleRandomize(localPlan.compound.exercise.id)}
              onSwap={() => setSwapExerciseId(localPlan.compound.exercise.id)}
              savedNotification={savedNotifications.has(localPlan.compound.exercise.id)}
              isRandomizing={isRandomizing === localPlan.compound.exercise.id}
              rating={ratingsMap[String(localPlan.compound.exercise.id)] ?? 0}
              onRate={(r) => setRatingsMap((p) => ({ ...p, [String(localPlan.compound.exercise.id)]: r }))} />

            {localPlan.compound2 && (
              <div style={{ marginTop: 8 }}>
                <ExerciseBlock item={localPlan.compound2} isCompound sets={setsMap[String(localPlan.compound2.exercise.id)] ?? []}
                  onSetWeight={(i, v) => updateSet(localPlan.compound2!.exercise.id, i, "weight", v)}
                  onSetReps={(i, v) => updateSet(localPlan.compound2!.exercise.id, i, "reps", v)}
                  onSave={() => handleSave(localPlan.compound2!.exercise.id)}
                  onRandomize={() => handleRandomize(localPlan.compound2!.exercise.id)}
                  onSwap={() => setSwapExerciseId(localPlan.compound2!.exercise.id)}
                  savedNotification={savedNotifications.has(localPlan.compound2.exercise.id)}
                  isRandomizing={isRandomizing === localPlan.compound2.exercise.id}
                  rating={ratingsMap[String(localPlan.compound2.exercise.id)] ?? 0}
                  onRate={(r) => setRatingsMap((p) => ({ ...p, [String(localPlan.compound2!.exercise.id)]: r }))} />
              </div>
            )}

            {localPlan.circuits.map((circuit, ci) => (
              <div key={ci} style={{ marginTop: 16 }}>
                <div className="section-label">Circuit {ci + 1}</div>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                  {circuit.exercises.map((item) => (
                    <ExerciseBlock key={item.exercise.id} item={item} isCompound={false}
                      sets={setsMap[String(item.exercise.id)] ?? []}
                      onSetWeight={(i, v) => updateSet(item.exercise.id, i, "weight", v)}
                      onSetReps={(i, v) => updateSet(item.exercise.id, i, "reps", v)}
                      onSave={() => handleSave(item.exercise.id)}
                      onRandomize={() => handleRandomize(item.exercise.id)}
                      onSwap={() => setSwapExerciseId(item.exercise.id)}
                      savedNotification={savedNotifications.has(item.exercise.id)}
                      isRandomizing={isRandomizing === item.exercise.id}
                      rating={ratingsMap[String(item.exercise.id)] ?? 0}
                      onRate={(r) => setRatingsMap((p) => ({ ...p, [String(item.exercise.id)]: r }))} />
                  ))}
                </div>
              </div>
            ))}

            {!session.isCompleted && (
              <div style={{ marginTop: 24 }}>
                <button className="btn-primary" onClick={handleMarkComplete}><CheckCircle2 size={18} /> Mark as Complete</button>
              </div>
            )}
            {session.isCompleted && (
              <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "hsl(83 97% 59%)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <CheckCircle2 size={15} /> Workout completed
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
