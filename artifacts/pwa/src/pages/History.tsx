import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronRight, Calendar, Dumbbell, CheckCircle2, Clock } from "lucide-react";
import { db } from "../db/index";
import type { WorkoutSession, SessionLog } from "../lib/types";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

interface SessionWithLogs extends WorkoutSession {
  logs: SessionLog[];
}

function SessionCard({ session }: { session: SessionWithLogs }) {
  const [expanded, setExpanded] = useState(false);

  const exerciseIds = [...new Set(session.logs.map((l) => l.exerciseId))];
  const plan = session.workoutPlanJson ? (() => {
    try { return JSON.parse(session.workoutPlanJson!); } catch { return null; }
  })() : null;

  const getExName = (id: number) => {
    if (plan) {
      const all = [
        plan.compound,
        plan.compound2,
        ...(plan.circuits ?? []).flatMap((c: any) => c.exercises ?? []),
      ].filter(Boolean);
      const match = all.find((e: any) => e?.exercise?.id === id);
      if (match) return match.exercise.name;
    }
    return `Exercise #${id}`;
  };

  return (
    <div className="session-card" style={{ marginBottom: 10 }} onClick={() => setExpanded((p) => !p)}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "hsl(0 0% 95%)" }}>
              {session.splitType}
              {session.splitVariant !== "Standard" && (
                <span style={{ color: "hsl(83 97% 59%)", marginLeft: 6, fontSize: 13 }}>
                  + Core
                </span>
              )}
            </div>
            {session.isCompleted && (
              <CheckCircle2 size={16} color="hsl(83 97% 59%)" />
            )}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "hsl(0 0% 50%)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={12} />
              {session.scheduledDate ? formatDate(session.scheduledDate) : formatDate(session.createdAt)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} />
              {formatTime(session.createdAt)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Dumbbell size={12} />
              {exerciseIds.length} exercises
            </span>
          </div>
        </div>
        {expanded ? <ChevronDown size={18} color="hsl(0 0% 50%)" /> : <ChevronRight size={18} color="hsl(0 0% 50%)" />}
      </div>

      {expanded && session.logs.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid hsl(0 0% 15%)", paddingTop: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {exerciseIds.map((exId) => {
              const exLogs = session.logs.filter((l) => l.exerciseId === exId);
              const firstLog = exLogs[0];
              const weights = exLogs.map((l) => l.weightUsed).filter(Boolean);
              const maxWeight = weights.length > 0 ? Math.max(...(weights as number[])) : null;
              return (
                <div key={exId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, color: "hsl(0 0% 85%)", flex: 1 }}>
                    {getExName(exId)}
                  </div>
                  <div style={{ fontSize: 12, color: "hsl(0 0% 55%)", textAlign: "right" }}>
                    {firstLog.sets}×{firstLog.reps}
                    {maxWeight ? <span style={{ color: "hsl(83 97% 59%)", marginLeft: 6 }}>{maxWeight} lbs</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expanded && session.logs.length === 0 && (
        <div style={{ marginTop: 10, fontSize: 13, color: "hsl(0 0% 45%)" }}>
          No sets logged for this session.
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const sessions = useLiveQuery(
    () => db.workoutSessions.orderBy("createdAt").reverse().toArray(),
    []
  );
  const logs = useLiveQuery(() => db.sessionLogs.toArray(), []);

  if (!sessions || !logs) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 50%)" }}>
        Loading…
      </div>
    );
  }

  const sessionsWithLogs: SessionWithLogs[] = sessions.map((s) => ({
    ...s,
    logs: logs.filter((l) => l.sessionId === s.id),
  }));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>History</div>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} logged
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
        {sessionsWithLogs.length === 0 ? (
          <div style={{
            marginTop: 48,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            color: "hsl(0 0% 40%)",
            textAlign: "center",
          }}>
            <Dumbbell size={48} strokeWidth={1} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "hsl(0 0% 55%)" }}>No workouts yet</div>
            <div style={{ fontSize: 13 }}>Generate your first workout on the Today tab</div>
          </div>
        ) : (
          sessionsWithLogs.map((s) => <SessionCard key={s.id} session={s} />)
        )}
      </div>
    </div>
  );
}
