import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, BarChart2, ChevronLeft, ChevronRight, Zap, Save } from "lucide-react";
import { db } from "../db/index";
import { generateWorkout, SPLIT_CYCLES } from "../lib/workoutGenerator";
import type { WorkoutSession } from "../lib/types";

interface Props {
  clientId: number;
  onBack: () => void;
  onViewExerciseHistory: (clientId: number) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toDateStr(d: Date) { return d.toISOString().split("T")[0]; }

export default function ClientDetail({ clientId, onBack, onViewExerciseHistory }: Props) {
  const client = useLiveQuery(() => db.clients.get(clientId), [clientId]);
  const sessions = useLiveQuery(
    () => db.workoutSessions.where("clientId").equals(clientId).toArray(),
    [clientId]
  );

  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const profile = useLiveQuery(() => db.userProfile.toCollection().first());

  useEffect(() => {
    if (client?.notes !== undefined) setNotes(client.notes ?? "");
  }, [client?.id, client?.notes]);

  const handleSaveNotes = async () => {
    if (!client?.id) return;
    await db.clients.update(client.id, { notes, updatedAt: new Date().toISOString() });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const todayStr = toDateStr(new Date());

  const sessionsByDate = new Map<string, WorkoutSession[]>();
  for (const s of sessions ?? []) {
    if (s.scheduledDate) {
      const arr = sessionsByDate.get(s.scheduledDate) ?? [];
      arr.push(s);
      sessionsByDate.set(s.scheduledDate, arr);
    }
  }

  const handleSchedule = async () => {
    if (!selectedDate || !profile) return;
    setIsScheduling(true);
    try {
      const cyclePairs = SPLIT_CYCLES[profile.preferredSplit] ?? [["Full Body", "Standard"]];
      const [splitType, splitVariant] = cyclePairs[0];
      const plan = await generateWorkout({
        splitType,
        splitVariant,
        difficultyLevel: profile.difficultyLevel,
        equipment: profile.equipment,
        scheduledDate: selectedDate,
        clientId,
      });
      await db.workoutSessions.add({
        splitType,
        splitVariant,
        scheduledDate: selectedDate,
        isCompleted: false,
        workoutPlanJson: JSON.stringify(plan),
        clientId,
        createdAt: new Date().toISOString(),
      } as WorkoutSession);
      setSelectedDate(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedDate) return;
    const toRemove = sessionsByDate.get(selectedDate) ?? [];
    for (const s of toRemove) {
      if (s.id) await db.workoutSessions.delete(s.id);
    }
    setSelectedDate(null);
  };

  if (!client) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 50%)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid hsl(0 0% 12%)" }}>
        <button
          type="button"
          onClick={onBack}
          style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(0 0% 13%)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "hsl(0 0% 95%)" }}>{client.name}</div>
          <div style={{ fontSize: 12, color: "hsl(0 0% 45%)" }}>
            {(sessions?.length ?? 0)} session{(sessions?.length ?? 0) !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onViewExerciseHistory(clientId)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 10,
            background: "hsl(83 97% 59% / 0.12)",
            border: "1px solid hsl(83 97% 59% / 0.3)",
            color: "hsl(83 97% 59%)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <BarChart2 size={15} />
          History
        </button>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "12px 16px 24px" }}>
        {/* Schedule */}
        <div className="section-label">Schedule</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button type="button" className="btn-secondary" onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ width: 36, height: 36, padding: 0, borderRadius: 10 }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: "hsl(0 0% 88%)" }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button type="button" className="btn-secondary" onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ width: 36, height: 36, padding: 0, borderRadius: 10 }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
          {DAY_NAMES.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "hsl(0 0% 40%)", padding: "3px 0" }}>{d}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {Array.from({ length: totalCells }, (_, i) => {
            const isCurrentMonth = i >= firstDay && i < firstDay + daysInMonth;
            const day = isCurrentMonth ? i - firstDay + 1 : 0;
            const dateStr = isCurrentMonth
              ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              : "";
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const sessionsOnDay = dateStr ? (sessionsByDate.get(dateStr) ?? []) : [];
            const hasCompleted = sessionsOnDay.some((s) => s.isCompleted);
            const hasSession = sessionsOnDay.length > 0;

            return (
              <button
                key={i}
                type="button"
                disabled={!isCurrentMonth}
                onClick={() => isCurrentMonth && setSelectedDate((p) => p === dateStr ? null : dateStr)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  border: isSelected
                    ? "2px solid hsl(83 97% 59%)"
                    : isToday
                    ? "2px solid hsl(83 97% 59% / 0.4)"
                    : "2px solid transparent",
                  background: hasCompleted
                    ? "hsl(83 97% 59%)"
                    : hasSession
                    ? "hsl(83 97% 59% / 0.18)"
                    : "hsl(0 0% 9%)",
                  cursor: isCurrentMonth ? "pointer" : "default",
                  opacity: isCurrentMonth ? 1 : 0.2,
                  minHeight: 44,
                  gap: 2,
                  transition: "all 0.12s",
                }}
              >
                {isCurrentMonth && (
                  <>
                    <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: hasCompleted ? "hsl(0 0% 5%)" : hasSession ? "hsl(83 97% 59%)" : isToday ? "hsl(83 97% 59%)" : "hsl(0 0% 78%)" }}>
                      {day}
                    </span>
                    {hasSession && !hasCompleted && (
                      <div style={{ width: 4, height: 4, borderRadius: 999, background: "hsl(83 97% 59%)" }} />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid hsl(0 0% 15%)", background: "hsl(0 0% 9%)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "hsl(0 0% 88%)", marginBottom: 10 }}>
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </div>
            {sessionsByDate.has(selectedDate) ? (
              <>
                {(sessionsByDate.get(selectedDate) ?? []).map((s) => (
                  <div key={s.id} style={{ fontSize: 14, color: "hsl(0 0% 70%)", marginBottom: 6 }}>
                    {s.splitType}{s.splitVariant !== "Standard" ? " + Core" : ""}
                    {s.isCompleted && <span style={{ color: "hsl(83 97% 59%)", marginLeft: 8, fontSize: 12 }}>✓ Done</span>}
                  </div>
                ))}
                {!(sessionsByDate.get(selectedDate) ?? []).every((s) => s.isCompleted) && (
                  <button type="button" className="btn-secondary" onClick={handleRemove} style={{ marginTop: 4, fontSize: 13, color: "hsl(0 72% 60%)", borderColor: "hsl(0 72% 40% / 0.4)" }}>
                    Remove
                  </button>
                )}
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={handleSchedule} disabled={isScheduling} style={{ fontSize: 14 }}>
                <Zap size={15} />
                {isScheduling ? "Scheduling…" : "Schedule Workout"}
              </button>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="section-label" style={{ marginTop: 24 }}>Notes</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this client's goals, limitations, progress…"
          rows={5}
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid hsl(0 0% 18%)",
            background: "hsl(0 0% 9%)",
            color: "hsl(0 0% 90%)",
            padding: "12px 14px",
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
            lineHeight: 1.6,
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 8 }}>
          {notesSaved && (
            <span style={{ fontSize: 12, color: "hsl(83 97% 59%)", fontWeight: 600 }}>✓ Saved</span>
          )}
          <button type="button" className="btn-secondary" onClick={handleSaveNotes} style={{ gap: 6 }}>
            <Save size={14} />
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}
