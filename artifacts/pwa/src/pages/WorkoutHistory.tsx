import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { db } from "../db/index";

interface Props {
  onBack: () => void;
}

interface SetData { weight?: string; reps?: string; }

interface LogEntry {
  logId: number;
  sessionId: number;
  date: string;
  sets: SetData[];
  weightUsed?: number;
}

interface ExerciseHistory {
  exerciseId: number;
  name: string;
  mostRecentWeight?: number;
  mostRecentDate: string;
  logCount: number;
  logs: LogEntry[];
}

export default function WorkoutHistory({ onBack }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const allLogs = useLiveQuery(() => db.sessionLogs.toArray(), []);
  const allSessions = useLiveQuery(() => db.workoutSessions.toArray(), []);
  const allExercises = useLiveQuery(() => db.exercises.toArray(), []);

  const exerciseMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const ex of allExercises ?? []) m.set(ex.id, ex.name);
    return m;
  }, [allExercises]);

  const sessionDateMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of allSessions ?? []) {
      if (s.id) m.set(s.id, s.scheduledDate ?? s.createdAt.split("T")[0]);
    }
    return m;
  }, [allSessions]);

  const histories = useMemo<ExerciseHistory[]>(() => {
    if (!allLogs || !exerciseMap.size) return [];
    const byExercise = new Map<number, LogEntry[]>();
    for (const log of allLogs) {
      if (!log.id) continue;
      let sets: SetData[] = [];
      if (log.setCompletions) {
        try { sets = JSON.parse(log.setCompletions); } catch {}
      }
      if (sets.length === 0 && log.sets) {
        sets = Array.from({ length: log.sets }, () => ({
          weight: log.weightUsed ? String(log.weightUsed) : undefined,
          reps: String(log.reps),
        }));
      }
      const date = sessionDateMap.get(log.sessionId) ?? log.loggedAt.split("T")[0];
      const entry: LogEntry = { logId: log.id, sessionId: log.sessionId, date, sets, weightUsed: log.weightUsed };
      const arr = byExercise.get(log.exerciseId) ?? [];
      arr.push(entry);
      byExercise.set(log.exerciseId, arr);
    }

    const result: ExerciseHistory[] = [];
    for (const [exerciseId, logs] of byExercise) {
      const name = exerciseMap.get(exerciseId) ?? `Exercise #${exerciseId}`;
      // Sort logs: most recent first for display, earliest first for expansion
      const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
      const mostRecentWeight = sorted.find((l) => l.weightUsed)?.weightUsed;
      result.push({
        exerciseId, name,
        mostRecentWeight,
        mostRecentDate: sorted[0]?.date ?? "",
        logCount: logs.length,
        logs: sorted,
      });
    }
    // Sort by most recent date desc
    return result.sort((a, b) => b.mostRecentDate.localeCompare(a.mostRecentDate));
  }, [allLogs, exerciseMap, sessionDateMap]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return histories;
    return histories.filter((h) => h.name.toLowerCase().includes(q));
  }, [histories, search]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return dateStr; }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid hsl(0 0% 12%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <button type="button" onClick={onBack}
            style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(0 0% 13%)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Exercise History</div>
            <div style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 1 }}>{filtered.length} exercises logged</div>
          </div>
        </div>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(0 0% 40%)" }} />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "hsl(0 0% 40%)", padding: 2 }}>
              <X size={14} />
            </button>
          )}
          <input type="text" placeholder="Search exercises…" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 10%)", color: "hsl(0 0% 90%)", padding: "0 36px", fontSize: 13, fontFamily: "inherit" }} />
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "12px 16px 24px" }}>
        {filtered.length === 0 && (
          <div style={{ marginTop: 40, textAlign: "center", color: "hsl(0 0% 40%)", fontSize: 14 }}>
            {search ? "No exercises match that search" : "No exercise history yet"}
          </div>
        )}

        {filtered.map((hist) => {
          const isOpen = expanded.has(hist.exerciseId);
          // When expanded, show chronological (earliest first)
          const chronoLogs = isOpen ? [...hist.logs].sort((a, b) => a.date.localeCompare(b.date)) : [];
          return (
            <div key={hist.exerciseId} style={{ marginBottom: 8, borderRadius: 14, border: "1px solid hsl(0 0% 15%)", background: "hsl(0 0% 9%)", overflow: "hidden" }}>
              {/* Row */}
              <button type="button" onClick={() => toggleExpand(hist.exerciseId)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" as const }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(0 0% 92%)" }}>{hist.name}</div>
                  <div style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 3 }}>
                    {hist.logCount} log{hist.logCount !== 1 ? "s" : ""}
                    <span style={{ marginLeft: 8, color: "hsl(0 0% 35%)" }}>Last: {formatDate(hist.mostRecentDate)}</span>
                  </div>
                </div>
                {hist.mostRecentWeight && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(83 97% 59%)", background: "hsl(83 97% 59% / 0.1)", padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap" as const }}>
                    {hist.mostRecentWeight} lbs
                  </div>
                )}
                {isOpen ? <ChevronUp size={16} color="hsl(0 0% 45%)" /> : <ChevronDown size={16} color="hsl(0 0% 45%)" />}
              </button>

              {/* Expanded detail — chronological */}
              {isOpen && (
                <div style={{ borderTop: "1px solid hsl(0 0% 13%)", padding: "10px 16px 14px" }}>
                  {chronoLogs.map((log, li) => (
                    <div key={log.logId} style={{ marginBottom: li < chronoLogs.length - 1 ? 14 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "hsl(0 0% 55%)", marginBottom: 6 }}>
                        {formatDate(log.date)}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
                        {log.sets.map((s, si) => (
                          <div key={si} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 22, height: 22, borderRadius: 999, background: "hsl(0 0% 16%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "hsl(0 0% 50%)", flexShrink: 0 }}>
                              {si + 1}
                            </div>
                            <span style={{ fontSize: 13, color: "hsl(0 0% 80%)" }}>
                              {s.weight ? <strong style={{ color: "hsl(0 0% 92%)" }}>{s.weight} lbs</strong> : <span style={{ color: "hsl(0 0% 45%)" }}>Bodyweight</span>}
                              {s.reps && s.reps !== "0" && <span style={{ color: "hsl(0 0% 50%)", marginLeft: 6 }}>× {s.reps} reps</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
