import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, CheckCircle2, Dumbbell } from "lucide-react";
import { db } from "../db/index";
import type { WorkoutPlan, ExerciseWithHistory } from "../lib/types";

interface Props {
  sessionId: number;
  onBack: () => void;
}

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

function ExerciseRow({ item, isCompound, savedLog }: {
  item: ExerciseWithHistory;
  isCompound: boolean;
  savedLog?: { sets: number; reps: number; weightUsed?: number; setCompletions?: string };
}) {
  const muscleTags = getMuscleLabels(item.exercise);

  let savedSets: Array<{ weight?: string; reps?: string }> = [];
  if (savedLog?.setCompletions) {
    try { savedSets = JSON.parse(savedLog.setCompletions); } catch {}
  }
  if (savedSets.length === 0 && savedLog) {
    savedSets = Array.from({ length: savedLog.sets }, () => ({
      weight: savedLog.weightUsed ? String(savedLog.weightUsed) : undefined,
      reps: String(savedLog.reps),
    }));
  }

  const lastW = item.lastLog?.weightUsed;

  return (
    <div className="exercise-card" style={{ gap: 10 }}>
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
            <span style={{ fontSize: 11, color: "hsl(0 0% 40%)", alignSelf: "center" }}>{item.exercise.equipment}</span>
          </div>
        </div>
        {lastW && !savedLog && (
          <div style={{ fontSize: 11, color: "hsl(83 97% 59%)", fontWeight: 600, background: "hsl(83 97% 59% / 0.1)", padding: "4px 8px", borderRadius: 8, whiteSpace: "nowrap" as const }}>
            Last: {lastW} lbs
          </div>
        )}
      </div>

      {/* Show saved sets if available, else suggested */}
      {savedSets.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
          {savedSets.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <div style={{ width: 24, height: 24, borderRadius: 999, background: "hsl(83 97% 59%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "hsl(0 0% 5%)", flexShrink: 0 }}>
                {i + 1}
              </div>
              <span style={{ color: "hsl(0 0% 85%)" }}>
                {s.weight ? <strong>{s.weight} lbs</strong> : <span style={{ color: "hsl(0 0% 50%)" }}>BW</span>}
                {s.reps && s.reps !== "0" && <span style={{ color: "hsl(0 0% 50%)", marginLeft: 6 }}>× {s.reps} reps</span>}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "hsl(0 0% 45%)" }}>
          {item.suggestedSets} sets × {item.suggestedReps} reps
          {lastW && <span style={{ color: "hsl(83 97% 59%)", marginLeft: 8 }}>· Last: {lastW} lbs</span>}
        </div>
      )}
    </div>
  );
}

export default function WorkoutDetail({ sessionId, onBack }: Props) {
  const session = useLiveQuery(() => db.workoutSessions.get(sessionId), [sessionId]);
  const logs = useLiveQuery(
    () => db.sessionLogs.where("sessionId").equals(sessionId).toArray(),
    [sessionId]
  );
  const client = useLiveQuery(
    () => session?.clientId ? db.clients.get(session.clientId) : Promise.resolve(undefined),
    [session?.clientId]
  );

  if (!session) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 50%)" }}>
        Loading…
      </div>
    );
  }

  let plan: WorkoutPlan | null = null;
  if (session.workoutPlanJson) {
    try { plan = JSON.parse(session.workoutPlanJson); } catch {}
  }

  const logByExercise = new Map((logs ?? []).map((l) => [l.exerciseId, l]));

  const scheduledDate = session.scheduledDate
    ? new Date(session.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : new Date(session.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid hsl(0 0% 12%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <button type="button" onClick={onBack}
            style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(0 0% 13%)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "hsl(0 0% 95%)" }}>
                {session.splitType}{session.splitVariant !== "Standard" && <span style={{ color: "hsl(83 97% 59%)", fontSize: 16 }}> + Core</span>}
              </span>
              {session.isCompleted && <CheckCircle2 size={18} color="hsl(83 97% 59%)" />}
            </div>
            <div style={{ fontSize: 13, color: "hsl(0 0% 50%)", marginTop: 2 }}>
              {scheduledDate}
              {client && <span style={{ color: "hsl(83 97% 59%)", marginLeft: 8, fontWeight: 600 }}>· {client.name}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "12px 16px 24px" }}>
        {!plan ? (
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 12, color: "hsl(0 0% 40%)", textAlign: "center" }}>
            <Dumbbell size={48} strokeWidth={1} />
            <div style={{ fontSize: 15, color: "hsl(0 0% 50%)" }}>No workout plan available</div>
          </div>
        ) : (
          <>
            <div className="section-label">Compound</div>
            <ExerciseRow item={plan.compound} isCompound savedLog={logByExercise.get(plan.compound.exercise.id)} />

            {plan.compound2 && (
              <div style={{ marginTop: 8 }}>
                <ExerciseRow item={plan.compound2} isCompound savedLog={logByExercise.get(plan.compound2.exercise.id)} />
              </div>
            )}

            {plan.circuits.map((circuit, ci) => (
              <div key={ci} style={{ marginTop: 16 }}>
                <div className="section-label">Circuit {ci + 1}</div>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                  {circuit.exercises.map((item) => (
                    <ExerciseRow
                      key={item.exercise.id}
                      item={item}
                      isCompound={false}
                      savedLog={logByExercise.get(item.exercise.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
