import { useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Zap, Eye } from "lucide-react";
import { db } from "../db/index";
import { generateWorkout, SPLIT_CYCLES } from "../lib/workoutGenerator";
import type { WorkoutSession } from "../lib/types";

interface Props {
  selectedClientId?: number;
  onOpenWorkout: (sessionId: number) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toDateStr(d: Date) { return d.toISOString().split("T")[0]; }

export default function Schedule({ selectedClientId, onOpenWorkout }: Props) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const profile = useLiveQuery(() => db.userProfile.toCollection().first());
  const sessions = useLiveQuery(() => db.workoutSessions.toArray(), []);
  const clients = useLiveQuery(() => db.clients.toArray(), []);
  const dayNotes = useLiveQuery(() => db.dayNotes.toArray(), []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const filteredSessions = (sessions ?? []).filter((s) =>
    selectedClientId !== undefined ? s.clientId === selectedClientId : true
  );

  const sessionsByDate = new Map<string, WorkoutSession[]>();
  for (const s of filteredSessions) {
    if (s.scheduledDate) {
      const arr = sessionsByDate.get(s.scheduledDate) ?? [];
      arr.push(s);
      sessionsByDate.set(s.scheduledDate, arr);
    }
  }

  // Notes: per date + clientId
  const getNoteForDate = useCallback((date: string) => {
    if (!dayNotes) return null;
    return dayNotes.find((n) => n.date === date && (n.clientId ?? undefined) === selectedClientId) ?? null;
  }, [dayNotes, selectedClientId]);

  const handleSaveNote = async (date: string) => {
    const text = noteDraft[date] ?? "";
    const existing = getNoteForDate(date);
    if (existing?.id) {
      await db.dayNotes.update(existing.id, { notes: text, updatedAt: new Date().toISOString() });
    } else if (text.trim()) {
      await db.dayNotes.add({ date, clientId: selectedClientId, notes: text, updatedAt: new Date().toISOString() });
    }
  };

  const clientMap = new Map((clients ?? []).map((c) => [c.id!, c.name]));
  const selectedClient = selectedClientId ? clientMap.get(selectedClientId) : undefined;

  const handleSchedule = async () => {
    if (!selectedDate) return;
    const difficultyLevel = profile?.difficultyLevel ?? "Intermediate";
    setIsScheduling(true);
    try {
      const cyclePairs = SPLIT_CYCLES[profile?.preferredSplit ?? "Full Body"] ?? [["Full Body", "Standard"]];
      const [splitType, splitVariant] = cyclePairs[0];
      const plan = await generateWorkout({ splitType, splitVariant, difficultyLevel, equipment: profile?.equipment ?? [], scheduledDate: selectedDate, clientId: selectedClientId });
      await db.workoutSessions.add({ splitType, splitVariant, scheduledDate: selectedDate, isCompleted: false, workoutPlanJson: JSON.stringify(plan), clientId: selectedClientId, createdAt: new Date().toISOString() } as WorkoutSession);
      setSelectedDate(null);
    } catch (err) { console.error(err); }
    finally { setIsScheduling(false); }
  };

  const handleRemove = async () => {
    if (!selectedDate) return;
    for (const s of sessionsByDate.get(selectedDate) ?? []) {
      if (s.id) { await db.sessionLogs.where("sessionId").equals(s.id).delete(); await db.workoutSessions.delete(s.id); }
    }
    setSelectedDate(null);
  };

  const todayStr = toDateStr(today);

  // When a date is selected, load its draft from existing note
  const handleSelectDate = (dateStr: string) => {
    setSelectedDate((p) => {
      if (p === dateStr) return null;
      // Initialize draft from stored note
      const existing = getNoteForDate(dateStr);
      if (existing) setNoteDraft((prev) => ({ ...prev, [dateStr]: existing.notes }));
      return dateStr;
    });
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)", marginBottom: 2 }}>Schedule</div>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>
          {selectedClient ? <span>For <span style={{ color: "hsl(83 97% 59%)", fontWeight: 600 }}>{selectedClient}</span></span> : "All scheduled workouts"}
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "0 16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0" }}>
          <button type="button" className="btn-secondary" onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ width: 40, height: 40, padding: 0, borderRadius: 10 }}><ChevronLeft size={18} /></button>
          <span style={{ fontSize: 16, fontWeight: 700, color: "hsl(0 0% 90%)" }}>{MONTH_NAMES[month]} {year}</span>
          <button type="button" className="btn-secondary" onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ width: 40, height: 40, padding: 0, borderRadius: 10 }}><ChevronRight size={18} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {DAY_NAMES.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "hsl(0 0% 45%)", padding: "4px 0" }}>{d}</div>)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {Array.from({ length: totalCells }, (_, i) => {
            const isCurrentMonth = i >= firstDay && i < firstDay + daysInMonth;
            const day = isCurrentMonth ? i - firstDay + 1 : 0;
            const dateStr = isCurrentMonth ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const sessionsOnDay = dateStr ? (sessionsByDate.get(dateStr) ?? []) : [];
            const hasCompleted = sessionsOnDay.some((s) => s.isCompleted);
            const hasSession = sessionsOnDay.length > 0;
            const hasNote = dateStr ? !!getNoteForDate(dateStr) : false;

            return (
              <button key={i} type="button" disabled={!isCurrentMonth}
                onClick={() => isCurrentMonth && handleSelectDate(dateStr)}
                style={{
                  display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
                  borderRadius: 10, minHeight: 48, gap: 2, transition: "all 0.15s",
                  border: isSelected ? "2px solid hsl(83 97% 59%)" : isToday ? "2px solid hsl(83 97% 59% / 0.5)" : "2px solid transparent",
                  background: hasCompleted ? "hsl(83 97% 59%)" : hasSession ? "hsl(83 97% 59% / 0.18)" : "hsl(0 0% 9%)",
                  cursor: isCurrentMonth ? "pointer" : "default", opacity: isCurrentMonth ? 1 : 0.25,
                }}>
                {isCurrentMonth && (
                  <>
                    <span style={{ fontSize: 14, fontWeight: isToday ? 800 : 500, color: hasCompleted ? "hsl(0 0% 5%)" : hasSession ? "hsl(83 97% 59%)" : isToday ? "hsl(83 97% 59%)" : "hsl(0 0% 80%)" }}>{day}</span>
                    <div style={{ display: "flex", gap: 2 }}>
                      {hasSession && !hasCompleted && <div style={{ width: 4, height: 4, borderRadius: 999, background: "hsl(83 97% 59%)" }} />}
                      {hasNote && <div style={{ width: 4, height: 4, borderRadius: 999, background: "hsl(200 80% 60%)" }} />}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 14, border: "1px solid hsl(0 0% 15%)", background: "hsl(0 0% 9%)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(0 0% 90%)", marginBottom: 12 }}>
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>

            {sessionsByDate.has(selectedDate) ? (
              <>
                {(sessionsByDate.get(selectedDate) ?? []).map((s) => (
                  <div key={s.id} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 14, color: "hsl(0 0% 80%)", marginBottom: 8 }}>
                      {s.splitType}{s.splitVariant !== "Standard" ? " + Core" : ""}
                      {s.clientId && <span style={{ color: "hsl(83 97% 59%)", marginLeft: 8, fontSize: 12 }}>{clientMap.get(s.clientId) ?? ""}</span>}
                      {s.isCompleted && <span style={{ color: "hsl(83 97% 59%)", marginLeft: 8, fontSize: 12 }}>✓ Done</span>}
                    </div>
                    {s.workoutPlanJson && (
                      <button type="button" onClick={() => onOpenWorkout(s.id!)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, background: "hsl(83 97% 59% / 0.12)", border: "1px solid hsl(83 97% 59% / 0.3)", color: "hsl(83 97% 59%)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                        <Eye size={14} /> See Workout
                      </button>
                    )}
                  </div>
                ))}
                {!(sessionsByDate.get(selectedDate) ?? []).every((s) => s.isCompleted) && (
                  <button type="button" className="btn-secondary" onClick={handleRemove} style={{ marginTop: 4, fontSize: 13, color: "hsl(0 72% 60%)", borderColor: "hsl(0 72% 40% / 0.4)" }}>Remove</button>
                )}
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={handleSchedule} disabled={isScheduling} style={{ fontSize: 14, marginBottom: 12 }}>
                <Zap size={16} />
                {isScheduling ? "Scheduling…" : selectedClientId ? `Schedule for ${clientMap.get(selectedClientId) ?? "client"}` : "Schedule Workout"}
              </button>
            )}

            {/* Day notes */}
            <div style={{ marginTop: 14, borderTop: "1px solid hsl(0 0% 13%)", paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(0 0% 50%)", marginBottom: 6 }}>
                NOTES{selectedClient ? ` — ${selectedClient}` : ""}
              </div>
              <textarea
                placeholder="Add notes for this day…"
                value={noteDraft[selectedDate] ?? getNoteForDate(selectedDate)?.notes ?? ""}
                onChange={(e) => setNoteDraft((p) => ({ ...p, [selectedDate]: e.target.value }))}
                onBlur={() => handleSaveNote(selectedDate)}
                style={{ width: "100%", minHeight: 72, borderRadius: 9, border: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 12%)", color: "hsl(0 0% 88%)", padding: "8px 10px", fontSize: 13, fontFamily: "inherit", resize: "vertical" as const, lineHeight: 1.5 }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
