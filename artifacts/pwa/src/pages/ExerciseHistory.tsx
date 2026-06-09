import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Search, ChevronDown, ChevronRight, Dumbbell, Star } from "lucide-react";
import { db } from "../db/index";

interface Props {
  clientId: number;
  onBack: () => void;
}

interface SetEntry {
  weight?: number;
  reps?: string;
}

interface LogEntry {
  date: string;
  sessionId: number;
  sets: SetEntry[];
  weightUsed?: number;
  rawReps: number;
  rating?: number;
}

interface ExerciseRow {
  id: number;
  name: string;
  highestWeight?: number;
  mostRecentDate: string;
  avgRating: number;
  entries: LogEntry[];
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StarDisplay({ value }: { value: number }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={11}
          fill={value >= s ? "hsl(43 96% 56%)" : "none"}
          color={value >= s ? "hsl(43 96% 56%)" : "hsl(0 0% 30%)"}
          strokeWidth={1.5} />
      ))}
    </div>
  );
}

export default function ExerciseHistory({ clientId, onBack }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const clientSessions = useLiveQuery(
    () => db.workoutSessions.where("clientId").equals(clientId).toArray(),
    [clientId]
  );
  const allLogs = useLiveQuery(() => db.sessionLogs.toArray(), []);
  const allExercises = useLiveQuery(() => db.exercises.toArray(), []);

  const exerciseRows = useMemo<ExerciseRow[]>(() => {
    if (!clientSessions || !allLogs || !allExercises) return [];

    const sessionIds = new Set(clientSessions.map((s) => s.id!));
    const sessionMap = new Map(clientSessions.map((s) => [s.id!, s]));

    const relevantLogs = allLogs.filter((l) => sessionIds.has(l.sessionId));

    const byExercise = new Map<number, LogEntry[]>();
    for (const log of relevantLogs) {
      const session = sessionMap.get(log.sessionId);
      if (!session) continue;
      const date = session.scheduledDate ?? session.createdAt.split("T")[0];

      let sets: SetEntry[] = [];
      if (log.setCompletions) {
        try {
          const parsed = JSON.parse(log.setCompletions);
          sets = Array.isArray(parsed)
            ? parsed.map((s: any) => ({ weight: parseFloat(s.weight) || undefined, reps: String(s.reps || "") }))
            : [];
        } catch {}
      }
      if (sets.length === 0 && log.weightUsed !== undefined) {
        sets = Array.from({ length: log.sets }, () => ({ weight: log.weightUsed, reps: String(log.reps) }));
      }

      const entry: LogEntry = {
        date,
        sessionId: log.sessionId,
        sets,
        weightUsed: log.weightUsed,
        rawReps: log.reps,
        rating: log.rating,
      };
      const existing = byExercise.get(log.exerciseId) ?? [];
      existing.push(entry);
      byExercise.set(log.exerciseId, existing);
    }

    const rows: ExerciseRow[] = [];
    const exerciseMap = new Map(allExercises.map((e) => [e.id, e]));

    for (const [exId, entries] of byExercise.entries()) {
      const exercise = exerciseMap.get(exId);
      if (!exercise) continue;

      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      const mostRecent = sorted[sorted.length - 1];

      // Highest weight across ALL sets and ALL sessions
      let highestWeight: number | undefined;
      for (const entry of entries) {
        for (const set of entry.sets) {
          if (set.weight && set.weight > 0 && (highestWeight === undefined || set.weight > highestWeight)) {
            highestWeight = set.weight;
          }
        }
        if (entry.weightUsed && (highestWeight === undefined || entry.weightUsed > highestWeight)) {
          highestWeight = entry.weightUsed;
        }
      }

      // Average star rating
      const rated = entries.filter((e) => e.rating && e.rating > 0);
      const avgRating = rated.length > 0
        ? Math.round(rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length)
        : 0;

      rows.push({
        id: exId,
        name: exercise.name,
        highestWeight,
        avgRating,
        mostRecentDate: mostRecent.date,
        entries: sorted,
      });
    }

    rows.sort((a, b) => b.mostRecentDate.localeCompare(a.mostRecentDate));
    return rows;
  }, [clientSessions, allLogs, allExercises]);

  const filtered = useMemo(() => {
    if (!search.trim()) return exerciseRows;
    const q = search.toLowerCase();
    return exerciseRows.filter((r) => r.name.toLowerCase().includes(q));
  }, [exerciseRows, search]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const client = useLiveQuery(() => db.clients.get(clientId), [clientId]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid hsl(0 0% 12%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(0 0% 13%)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Exercise History</div>
            {client && (
              <div style={{ fontSize: 13, color: "hsl(83 97% 59%)", fontWeight: 600 }}>{client.name}</div>
            )}
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "hsl(0 0% 40%)" }} />
          <input
            type="text"
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              height: 42,
              borderRadius: 10,
              border: "1px solid hsl(0 0% 18%)",
              background: "hsl(0 0% 10%)",
              color: "hsl(0 0% 90%)",
              padding: "0 12px 0 38px",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
        {filtered.length === 0 && (
          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "hsl(0 0% 40%)", textAlign: "center" }}>
            <Dumbbell size={48} strokeWidth={1} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(0 0% 50%)" }}>
              {exerciseRows.length === 0 ? "No exercise data yet" : "No matches"}
            </div>
            <div style={{ fontSize: 13 }}>
              {exerciseRows.length === 0
                ? "Generate and save workouts for this client to see their history"
                : "Try a different search term"}
            </div>
          </div>
        )}

        {filtered.map((row) => {
          const isExpanded = expanded.has(row.id);
          return (
            <div key={row.id} style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => toggleExpand(row.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: isExpanded ? "12px 12px 0 0" : 12,
                  border: `1px solid ${isExpanded ? "hsl(83 97% 59% / 0.3)" : "hsl(0 0% 15%)"}`,
                  borderBottom: isExpanded ? "none" : undefined,
                  background: "hsl(0 0% 9%)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "left",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "hsl(0 0% 92%)" }}>{row.name}</span>
                    {row.avgRating > 0 && <StarDisplay value={row.avgRating} />}
                  </div>
                  <div style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 2 }}>
                    Last used {formatDate(row.mostRecentDate)}
                    {" · "}{row.entries.length} session{row.entries.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                  {row.highestWeight !== undefined ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(83 97% 59%)" }}>
                        {row.highestWeight} lbs
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "hsl(0 0% 38%)", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>best</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "hsl(0 0% 40%)" }}>BW</div>
                  )}
                </div>
                {isExpanded
                  ? <ChevronDown size={16} color="hsl(0 0% 45%)" style={{ flexShrink: 0 }} />
                  : <ChevronRight size={16} color="hsl(0 0% 45%)" style={{ flexShrink: 0 }} />}
              </button>

              {isExpanded && (
                <div style={{
                  border: "1px solid hsl(83 97% 59% / 0.3)",
                  borderTop: "1px solid hsl(0 0% 13%)",
                  borderRadius: "0 0 12px 12px",
                  background: "hsl(0 0% 7%)",
                  overflow: "hidden",
                }}>
                  {row.entries.map((entry, ei) => (
                    <div
                      key={`${entry.sessionId}-${ei}`}
                      style={{
                        padding: "12px 16px",
                        borderBottom: ei < row.entries.length - 1 ? "1px solid hsl(0 0% 12%)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "hsl(83 97% 59%)", letterSpacing: "0.04em" }}>
                          {formatDate(entry.date)}
                        </div>
                        {entry.rating && entry.rating > 0 && <StarDisplay value={entry.rating} />}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {entry.sets.length > 0 ? (
                          entry.sets.map((set, si) => (
                            <div key={si} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 22, height: 22, borderRadius: 999, background: "hsl(0 0% 15%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "hsl(0 0% 55%)", flexShrink: 0 }}>
                                {si + 1}
                              </div>
                              <div style={{ fontSize: 14, color: "hsl(0 0% 80%)" }}>
                                {set.weight ? <strong style={{ color: "hsl(0 0% 92%)" }}>{set.weight} lbs</strong> : <span style={{ color: "hsl(0 0% 50%)" }}>BW</span>}
                                {set.reps && set.reps !== "0" && (
                                  <span style={{ color: "hsl(0 0% 50%)", marginLeft: 6 }}>× {set.reps} reps</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: 13, color: "hsl(0 0% 45%)" }}>
                            {entry.weightUsed ? `${entry.weightUsed} lbs` : "Bodyweight"} × {entry.rawReps} reps
                          </div>
                        )}
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
