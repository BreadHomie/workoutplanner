import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronRight, Calendar, Dumbbell, CheckCircle2, Clock } from "lucide-react";
import { db } from "../db/index";
import type { WorkoutSession, SessionLog } from "../lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

interface SessionWithLogs extends WorkoutSession {
  logs: SessionLog[];
  clientName?: string;
}

function SessionCard({ session }: { session: SessionWithLogs }) {
  const [expanded, setExpanded] = useState(false);
  const exerciseIds = [...new Set(session.logs.map((l) => l.exerciseId))];
  const plan = session.workoutPlanJson ? (() => { try { return JSON.parse(session.workoutPlanJson!); } catch { return null; } })() : null;

  const getExName = (id: number) => {
    if (plan) {
      const all = [plan.compound, plan.compound2, ...(plan.circuits ?? []).flatMap((c: any) => c.exercises ?? [])].filter(Boolean);
      const match = all.find((e: any) => e?.exercise?.id === id);
      if (match) return match.exercise.name;
    }
    return `Exercise #${id}`;
  };

  return (
    <div className="card" style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => setExpanded((p) => !p)}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(0 0% 95%)" }}>
              {session.splitType}
              {session.splitVariant !== "Standard" && (
                <span style={{ color: "hsl(83 97% 59%)", marginLeft: 6, fontSize: 13 }}>+ Core</span>
              )}
            </div>
            {session.isCompleted && <CheckCircle2 size={15} color="hsl(83 97% 59%)" />}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 12, color: "hsl(0 0% 45%)", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Calendar size={11} />
              {session.scheduledDate ? formatDate(session.scheduledDate) : formatDate(session.createdAt)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={11} />
              {formatTime(session.createdAt)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Dumbbell size={11} />
              {exerciseIds.length} exercises
            </span>
            {session.clientName && (
              <span style={{ color: "hsl(83 97% 59%)", fontWeight: 600 }}>{session.clientName}</span>
            )}
          </div>
        </div>
        {expanded ? <ChevronDown size={17} color="hsl(0 0% 45%)" /> : <ChevronRight size={17} color="hsl(0 0% 45%)" />}
      </div>

      {expanded && session.logs.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid hsl(0 0% 14%)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
          {exerciseIds.map((exId) => {
            const exLogs = session.logs.filter((l) => l.exerciseId === exId);
            const firstLog = exLogs[0];
            const weights = exLogs.map((l) => l.weightUsed).filter(Boolean) as number[];
            const maxWeight = weights.length > 0 ? Math.max(...weights) : null;
            return (
              <div key={exId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, color: "hsl(0 0% 82%)", flex: 1 }}>{getExName(exId)}</div>
                <div style={{ fontSize: 12, color: "hsl(0 0% 50%)", textAlign: "right" }}>
                  {firstLog.sets}×{firstLog.reps}
                  {maxWeight ? <span style={{ color: "hsl(83 97% 59%)", marginLeft: 6 }}>{maxWeight} lbs</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {expanded && session.logs.length === 0 && (
        <div style={{ marginTop: 10, fontSize: 13, color: "hsl(0 0% 40%)" }}>No sets saved for this session.</div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [filterClientId, setFilterClientId] = useState<number | "all">("all");
  const sessions = useLiveQuery(() => db.workoutSessions.orderBy("createdAt").reverse().toArray(), []);
  const logs = useLiveQuery(() => db.sessionLogs.toArray(), []);
  const clients = useLiveQuery(() => db.clients.orderBy("name").toArray(), []);

  if (!sessions || !logs) {
    return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 50%)" }}>Loading…</div>;
  }

  const clientMap = new Map((clients ?? []).map((c) => [c.id!, c.name]));

  const filtered = filterClientId === "all"
    ? sessions
    : sessions.filter((s) => s.clientId === filterClientId);

  const sessionsWithLogs: SessionWithLogs[] = filtered.map((s) => ({
    ...s,
    logs: logs.filter((l) => l.sessionId === s.id),
    clientName: s.clientId ? clientMap.get(s.clientId) : undefined,
  }));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>History</div>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>{filtered.length} session{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
        {/* Client filter */}
        {clients && clients.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            <button
              type="button"
              className={`chip${filterClientId === "all" ? " active" : ""}`}
              onClick={() => setFilterClientId("all")}
            >
              All
            </button>
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip${filterClientId === c.id ? " active" : ""}`}
                onClick={() => setFilterClientId(c.id!)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {sessionsWithLogs.length === 0 ? (
          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "hsl(0 0% 40%)", textAlign: "center" }}>
            <Dumbbell size={48} strokeWidth={1} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "hsl(0 0% 55%)" }}>No workouts yet</div>
            <div style={{ fontSize: 13 }}>Generate your first workout on the Generate tab</div>
          </div>
        ) : (
          sessionsWithLogs.map((s) => <SessionCard key={s.id} session={s} />)
        )}
      </div>
    </div>
  );
}
