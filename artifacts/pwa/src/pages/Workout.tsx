import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Dumbbell, ChevronRight, CheckCircle2, CalendarDays } from "lucide-react";
import { db } from "../db/index";

interface Props {
  onOpenWorkout: (sessionId: number) => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `In ${diff} days`;
}

export default function WorkoutTab({ onOpenWorkout }: Props) {
  const [filterClientId, setFilterClientId] = useState<number | "all">("all");
  const sessions = useLiveQuery(() => db.workoutSessions.orderBy("scheduledDate").toArray(), []);
  const clients = useLiveQuery(() => db.clients.orderBy("name").toArray(), []);

  const today = new Date().toISOString().split("T")[0];
  const clientMap = new Map((clients ?? []).map((c) => [c.id!, c.name]));

  // Show all scheduled sessions (upcoming + today), sorted by date
  const filtered = (sessions ?? [])
    .filter((s) => {
      if (!s.scheduledDate) return false;
      if (s.scheduledDate < today) return false; // only today and future
      if (filterClientId !== "all" && s.clientId !== filterClientId) return false;
      return true;
    })
    .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""));

  const completed = (sessions ?? [])
    .filter((s) => s.isCompleted)
    .sort((a, b) => (b.scheduledDate ?? b.createdAt).localeCompare(a.scheduledDate ?? a.createdAt));

  const getPlanExerciseCount = (planJson?: string) => {
    if (!planJson) return null;
    try {
      const plan = JSON.parse(planJson);
      const count = 1 + (plan.compound2 ? 1 : 0) + (plan.circuits ?? []).reduce((acc: number, c: any) => acc + (c.exercises?.length ?? 0), 0);
      return count;
    } catch { return null; }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Workouts</div>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>{filtered.length} upcoming</div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
        {/* Client filter */}
        {clients && clients.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 14 }}>
            <button type="button" className={`chip${filterClientId === "all" ? " active" : ""}`} onClick={() => setFilterClientId("all")}>All</button>
            {clients.map((c) => (
              <button key={c.id} type="button" className={`chip${filterClientId === c.id ? " active" : ""}`} onClick={() => setFilterClientId(c.id!)}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Upcoming */}
        {filtered.length === 0 && (
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 12, color: "hsl(0 0% 40%)", textAlign: "center" }}>
            <CalendarDays size={48} strokeWidth={1} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "hsl(0 0% 55%)" }}>No upcoming workouts</div>
            <div style={{ fontSize: 13 }}>Use Generate to plan workouts for your clients</div>
          </div>
        )}

        {filtered.map((session) => {
          const exCount = getPlanExerciseCount(session.workoutPlanJson);
          const clientName = session.clientId ? clientMap.get(session.clientId) : undefined;
          const dateLabel = formatDate(session.scheduledDate!);
          const until = daysUntil(session.scheduledDate!);
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => onOpenWorkout(session.id!)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 14, marginBottom: 8,
                border: session.scheduledDate === today ? "1px solid hsl(83 97% 59% / 0.4)" : "1px solid hsl(0 0% 15%)",
                background: session.scheduledDate === today ? "hsl(83 97% 59% / 0.05)" : "hsl(0 0% 9%)",
                cursor: "pointer", textAlign: "left" as const,
              }}
            >
              {/* Date badge */}
              <div style={{
                minWidth: 52, textAlign: "center" as const, padding: "8px 6px", borderRadius: 10,
                background: session.scheduledDate === today ? "hsl(83 97% 59%)" : "hsl(0 0% 14%)",
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: session.scheduledDate === today ? "hsl(0 0% 5%)" : "hsl(0 0% 85%)" }}>
                  {new Date(session.scheduledDate! + "T12:00:00").getDate()}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: session.scheduledDate === today ? "hsl(0 0% 15%)" : "hsl(0 0% 50%)", textTransform: "uppercase" as const }}>
                  {new Date(session.scheduledDate! + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(0 0% 92%)" }}>
                  {session.splitType}{session.splitVariant !== "Standard" ? " + Core" : ""}
                </div>
                <div style={{ fontSize: 12, color: "hsl(0 0% 48%)", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                  <span>{dateLabel}</span>
                  {exCount && <span>· {exCount} exercises</span>}
                  {clientName && <span style={{ color: "hsl(83 97% 59%)" }}>· {clientName}</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: session.scheduledDate === today ? "hsl(83 97% 59%)" : "hsl(0 0% 45%)" }}>
                  {until}
                </span>
                <ChevronRight size={16} color="hsl(0 0% 40%)" />
              </div>
            </button>
          );
        })}

        {/* Recently completed */}
        {completed.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 24 }}>Recently Completed</div>
            {completed.slice(0, 5).map((session) => {
              const clientName = session.clientId ? clientMap.get(session.clientId) : undefined;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onOpenWorkout(session.id!)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 16px", borderRadius: 14, marginBottom: 6,
                    border: "1px solid hsl(0 0% 13%)", background: "hsl(0 0% 7%)",
                    cursor: "pointer", textAlign: "left" as const, opacity: 0.75,
                  }}
                >
                  <CheckCircle2 size={20} color="hsl(83 97% 59%)" strokeWidth={1.5} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "hsl(0 0% 80%)" }}>
                      {session.splitType}{session.splitVariant !== "Standard" ? " + Core" : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "hsl(0 0% 40%)" }}>
                      {session.scheduledDate ? formatDate(session.scheduledDate) : "—"}
                      {clientName && <span style={{ color: "hsl(83 97% 59% / 0.7)", marginLeft: 6 }}>· {clientName}</span>}
                    </div>
                  </div>
                  <ChevronRight size={14} color="hsl(0 0% 35%)" />
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
