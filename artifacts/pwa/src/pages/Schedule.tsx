import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { db } from "../db/index";
import { generateWorkout, SPLIT_CYCLES } from "../lib/workoutGenerator";
import type { WorkoutSession } from "../lib/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function Schedule() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  const profile = useLiveQuery(() => db.userProfile.toCollection().first());
  const sessions = useLiveQuery(() => db.workoutSessions.toArray(), []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const sessionsByDate = new Map<string, WorkoutSession[]>();
  for (const s of sessions ?? []) {
    if (s.scheduledDate) {
      const arr = sessionsByDate.get(s.scheduledDate) ?? [];
      arr.push(s);
      sessionsByDate.set(s.scheduledDate, arr);
    }
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const handleDayClick = (dateStr: string) => {
    setSelectedDate((prev) => prev === dateStr ? null : dateStr);
  };

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
      });
      await db.workoutSessions.add({
        splitType,
        splitVariant,
        scheduledDate: selectedDate,
        isCompleted: false,
        workoutPlanJson: JSON.stringify(plan),
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

  const todayStr = toDateStr(today);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)", marginBottom: 2 }}>Schedule</div>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>Plan your training week</div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "0 16px 24px" }}>
        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={prevMonth} style={{ width: 40, height: 40, padding: 0, borderRadius: 10 }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: "hsl(0 0% 90%)" }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button type="button" className="btn-secondary" onClick={nextMonth} style={{ width: 40, height: 40, padding: 0, borderRadius: 10 }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {DAY_NAMES.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "hsl(0 0% 45%)", padding: "4px 0" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {Array.from({ length: totalCells }, (_, i) => {
            let day: number;
            let isCurrentMonth = true;
            if (i < firstDay) {
              day = daysInPrev - firstDay + i + 1;
              isCurrentMonth = false;
            } else if (i >= firstDay + daysInMonth) {
              day = i - firstDay - daysInMonth + 1;
              isCurrentMonth = false;
            } else {
              day = i - firstDay + 1;
            }

            const dateStr = isCurrentMonth
              ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              : "";
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const sessionsOnDay = dateStr ? (sessionsByDate.get(dateStr) ?? []) : [];
            const hasSession = sessionsOnDay.length > 0;
            const hasCompleted = sessionsOnDay.some((s) => s.isCompleted);

            return (
              <button
                key={i}
                type="button"
                disabled={!isCurrentMonth}
                onClick={() => isCurrentMonth && handleDayClick(dateStr)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  border: isSelected
                    ? "2px solid hsl(83 97% 59%)"
                    : isToday
                    ? "2px solid hsl(83 97% 59% / 0.5)"
                    : "2px solid transparent",
                  background: hasCompleted
                    ? "hsl(83 97% 59%)"
                    : hasSession
                    ? "hsl(83 97% 59% / 0.18)"
                    : "hsl(0 0% 9%)",
                  cursor: isCurrentMonth ? "pointer" : "default",
                  opacity: isCurrentMonth ? 1 : 0.25,
                  minHeight: 48,
                  gap: 2,
                  transition: "all 0.15s",
                }}
              >
                <span style={{
                  fontSize: 14,
                  fontWeight: isToday ? 800 : 500,
                  color: hasCompleted
                    ? "hsl(0 0% 5%)"
                    : hasSession
                    ? "hsl(83 97% 59%)"
                    : isToday
                    ? "hsl(83 97% 59%)"
                    : "hsl(0 0% 80%)",
                }}>
                  {day}
                </span>
                {hasSession && !hasCompleted && (
                  <div style={{ width: 4, height: 4, borderRadius: 999, background: "hsl(83 97% 59%)" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day panel */}
        {selectedDate && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 14, border: "1px solid hsl(0 0% 15%)", background: "hsl(0 0% 9%)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(0 0% 90%)", marginBottom: 12 }}>
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>

            {sessionsByDate.has(selectedDate) ? (
              <>
                {(sessionsByDate.get(selectedDate) ?? []).map((s) => (
                  <div key={s.id} style={{ fontSize: 14, color: "hsl(0 0% 75%)", marginBottom: 8 }}>
                    {s.splitType}{s.splitVariant !== "Standard" ? " + Core" : ""}
                    {s.isCompleted && <span style={{ color: "hsl(83 97% 59%)", marginLeft: 8, fontSize: 12 }}>✓ Done</span>}
                  </div>
                ))}
                {!(sessionsByDate.get(selectedDate) ?? []).every((s) => s.isCompleted) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleRemove}
                    style={{ marginTop: 4, fontSize: 13, color: "hsl(0 72% 60%)", borderColor: "hsl(0 72% 40% / 0.4)" }}
                  >
                    Remove
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSchedule}
                disabled={isScheduling}
                style={{ fontSize: 14 }}
              >
                <Zap size={16} />
                {isScheduling ? "Scheduling…" : "Schedule Workout"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
