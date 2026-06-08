import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { TrendingUp, Award, Flame, Zap, X, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { db } from "../db/index";

interface Props {
  selectedClientId?: number;
}

type TimeRange = "week" | "month" | "year";

function isoWeekStart(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function dateLabel(dateStr: string, range: TimeRange) {
  const d = new Date(dateStr + "T12:00:00");
  if (range === "week") return d.toLocaleDateString("en-US", { weekday: "short" });
  if (range === "month") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

const motivationalMessages = [
  "Every rep is progress. Keep showing up! 💪",
  "Consistency is your superpower. You're building something great!",
  "Progress, not perfection. You're doing amazing!",
  "Your future self will thank you for today's effort.",
  "Small steps daily lead to big results. Keep going!",
];

export default function Progress({ selectedClientId }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("month");
  const [showRecap, setShowRecap] = useState(false);

  const allSessions = useLiveQuery(() => db.workoutSessions.toArray(), []);
  const allLogs = useLiveQuery(() => db.sessionLogs.toArray(), []);
  const allExercises = useLiveQuery(() => db.exercises.toArray(), []);
  const clients = useLiveQuery(() => db.clients.toArray(), []);

  const clientMap = useMemo(() => new Map((clients ?? []).map((c) => [c.id!, c.name])), [clients]);
  const selectedClientName = selectedClientId ? clientMap.get(selectedClientId) : undefined;

  // Filter sessions by client
  const sessions = useMemo(() =>
    (allSessions ?? []).filter((s) => selectedClientId !== undefined ? s.clientId === selectedClientId : true),
    [allSessions, selectedClientId]
  );

  // Filter logs to sessions belonging to this client
  const sessionIds = useMemo(() => new Set(sessions.map((s) => s.id!).filter(Boolean)), [sessions]);
  const logs = useMemo(() => (allLogs ?? []).filter((l) => sessionIds.has(l.sessionId)), [allLogs, sessionIds]);

  const exerciseMap = useMemo(() => new Map((allExercises ?? []).map((e) => [e.id, e.name])), [allExercises]);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // ── Weight chart data ──────────────────────────────────────────────────────
  const weightChartData = useMemo(() => {
    const now = new Date();
    let cutoff: Date;
    if (timeRange === "week") { cutoff = new Date(now); cutoff.setDate(now.getDate() - 7); }
    else if (timeRange === "month") { cutoff = new Date(now); cutoff.setDate(now.getDate() - 30); }
    else { cutoff = new Date(now); cutoff.setFullYear(now.getFullYear() - 1); }
    const cutoffStr = cutoff.toISOString().split("T")[0];

    return sessions
      .filter((s) => s.bodyWeight && s.scheduledDate && s.scheduledDate >= cutoffStr)
      .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))
      .map((s) => ({ date: s.scheduledDate!, weight: s.bodyWeight!, label: dateLabel(s.scheduledDate!, timeRange) }));
  }, [sessions, timeRange]);

  // ── Personal records (up to 3 most recent) ─────────────────────────────────
  const personalRecords = useMemo(() => {
    if (!logs.length || !exerciseMap.size) return [];
    const byExercise = new Map<number, Array<{ date: string; weight: number }>>();
    for (const log of logs) {
      if (!log.weightUsed) continue;
      const session = allSessions?.find((s) => s.id === log.sessionId);
      const date = session?.scheduledDate ?? log.loggedAt.split("T")[0];
      const arr = byExercise.get(log.exerciseId) ?? [];
      arr.push({ date, weight: log.weightUsed });
      byExercise.set(log.exerciseId, arr);
    }
    const prs: Array<{ name: string; weight: number; date: string; isNew: boolean }> = [];
    for (const [exerciseId, entries] of byExercise) {
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length < 2) continue;
      const maxWeight = Math.max(...sorted.map((e) => e.weight));
      const maxEntry = [...sorted].sort((a, b) => b.weight - a.weight)[0];
      const prevMax = Math.max(...sorted.slice(0, -1).map((e) => e.weight));
      const isNew = maxEntry.weight > prevMax;
      prs.push({ name: exerciseMap.get(exerciseId) ?? `#${exerciseId}`, weight: maxWeight, date: maxEntry.date, isNew });
    }
    return prs.sort((a, b) => b.date.localeCompare(a.date)).filter((p) => p.isNew).slice(0, 3);
  }, [logs, exerciseMap, allSessions]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.isCompleted);
    const weekStart = isoWeekStart(today).toISOString().split("T")[0];
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    const thisWeek = completed.filter((s) => s.scheduledDate && s.scheduledDate >= weekStart);
    const thisMonth = completed.filter((s) => s.scheduledDate && s.scheduledDate >= monthStart);

    // Streak: consecutive days with a completed session ending today or yesterday
    const completedDates = new Set(completed.map((s) => s.scheduledDate ?? "").filter(Boolean));
    let streak = 0;
    const d = new Date(today);
    if (!completedDates.has(todayStr)) d.setDate(d.getDate() - 1);
    while (completedDates.has(d.toISOString().split("T")[0])) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    const totalVolume = logs.reduce((sum, l) => {
      if (!l.weightUsed || !l.sets || !l.reps) return sum;
      return sum + l.weightUsed * l.sets * l.reps;
    }, 0);

    const weightEntries = sessions.filter((s) => s.bodyWeight && s.scheduledDate).sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""));
    const weightChange = weightEntries.length >= 2
      ? (weightEntries.at(-1)!.bodyWeight! - weightEntries[0].bodyWeight!).toFixed(1)
      : null;

    const avgEnergy = sessions.filter((s) => s.energyLevel).length > 0
      ? (sessions.filter((s) => s.energyLevel).reduce((sum, s) => sum + (s.energyLevel ?? 0), 0) / sessions.filter((s) => s.energyLevel).length).toFixed(1)
      : null;

    return { total: completed.length, thisWeek: thisWeek.length, thisMonth: thisMonth.length, streak, totalVolume, weightChange, avgEnergy };
  }, [sessions, logs, today]);

  // ── Weekly recap ───────────────────────────────────────────────────────────
  const weeklyRecap = useMemo(() => {
    const weekStart = isoWeekStart(today).toISOString().split("T")[0];
    const weekSessions = sessions.filter((s) => s.isCompleted && s.scheduledDate && s.scheduledDate >= weekStart);
    const weekLogSessions = new Set(weekSessions.map((s) => s.id!));
    const weekLogs = logs.filter((l) => weekLogSessions.has(l.sessionId));

    const newPRsThisWeek = personalRecords.filter((pr) => pr.date >= weekStart).length;
    const volume = weekLogs.reduce((sum, l) => sum + (l.weightUsed ?? 0) * (l.sets ?? 0) * (l.reps ?? 0), 0);
    const splits = [...new Set(weekSessions.map((s) => s.splitType))];
    const msg = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    return { count: weekSessions.length, newPRs: newPRsThisWeek, volume: Math.round(volume), splits, msg };
  }, [sessions, logs, personalRecords]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Progress</div>
            <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>
              {selectedClientName ? <span>Tracking <span style={{ color: "hsl(83 97% 59%)", fontWeight: 600 }}>{selectedClientName}</span></span> : "Your progress overview"}
            </div>
          </div>
          <button type="button" onClick={() => setShowRecap(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "hsl(83 97% 59% / 0.15)", border: "1px solid hsl(83 97% 59% / 0.3)", color: "hsl(83 97% 59%)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            <Zap size={14} /> Weekly Recap
          </button>
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 32px" }}>
        {/* Stat pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" as const }}>
          {[
            { label: "Total Sessions", value: stats.total },
            { label: "This Week", value: stats.thisWeek },
            { label: "This Month", value: stats.thisMonth },
            { label: "Streak", value: `${stats.streak}d` },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: "1 1 80px", padding: "12px 10px", borderRadius: 12, border: "1px solid hsl(0 0% 15%)", background: "hsl(0 0% 9%)", textAlign: "center" as const }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(83 97% 59%)" }}>{value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "hsl(0 0% 50%)", marginTop: 2 }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Weight chart */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(0 0% 85%)" }}>Body Weight</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["week", "month", "year"] as TimeRange[]).map((r) => (
                <button key={r} type="button" onClick={() => setTimeRange(r)}
                  style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid", borderColor: timeRange === r ? "hsl(83 97% 59%)" : "hsl(0 0% 18%)", background: timeRange === r ? "hsl(83 97% 59% / 0.15)" : "hsl(0 0% 9%)", color: timeRange === r ? "hsl(83 97% 59%)" : "hsl(0 0% 50%)" }}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: "16px 0 8px", borderRadius: 14, border: "1px solid hsl(0 0% 13%)", background: "hsl(0 0% 8%)" }}>
            {weightChartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={weightChartData} margin={{ top: 4, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 13%)" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(0 0% 35%)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(0 0% 35%)" fontSize={10} tickLine={false} axisLine={false} domain={["auto", "auto"]} unit=" lb" />
                  <Tooltip
                    contentStyle={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(0 0% 75%)" }}
                    itemStyle={{ color: "hsl(83 97% 59%)" }}
                    formatter={(v: any) => [`${v} lbs`, "Weight"]}
                  />
                  <Line type="monotone" dataKey="weight" stroke="hsl(83 97% 59%)" strokeWidth={2.5} dot={{ fill: "hsl(83 97% 59%)", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 6, color: "hsl(0 0% 40%)" }}>
                <TrendingUp size={32} strokeWidth={1} />
                <div style={{ fontSize: 13 }}>Log body weight in workouts to see the chart</div>
              </div>
            )}
          </div>
          {stats.weightChange !== null && (
            <div style={{ marginTop: 8, fontSize: 13, color: "hsl(0 0% 55%)", textAlign: "center" as const }}>
              Overall change: <strong style={{ color: parseFloat(stats.weightChange) <= 0 ? "hsl(83 97% 59%)" : "hsl(0 72% 60%)" }}>{parseFloat(stats.weightChange) > 0 ? "+" : ""}{stats.weightChange} lbs</strong>
            </div>
          )}
        </div>

        {/* Personal Records */}
        {personalRecords.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(0 0% 85%)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Award size={16} color="hsl(43 96% 56%)" /> Recent PRs
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              {personalRecords.map((pr, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid hsl(43 96% 56% / 0.25)", background: "hsl(43 96% 56% / 0.05)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: "hsl(43 96% 56% / 0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Award size={15} color="hsl(43 96% 56%)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0 0% 90%)" }}>{pr.name}</div>
                    <div style={{ fontSize: 11, color: "hsl(0 0% 45%)", marginTop: 2 }}>{new Date(pr.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "hsl(43 96% 56%)" }}>{pr.weight} lbs</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extra affirming stats */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 24 }}>
          {stats.streak >= 3 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid hsl(25 95% 55% / 0.25)", background: "hsl(25 95% 55% / 0.06)" }}>
              <Flame size={20} color="hsl(25 95% 55%)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(0 0% 90%)" }}>{stats.streak}-Day Streak 🔥</div>
                <div style={{ fontSize: 11, color: "hsl(0 0% 50%)" }}>You're on a roll — consistency is everything!</div>
              </div>
            </div>
          )}
          {stats.totalVolume > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid hsl(0 0% 15%)", background: "hsl(0 0% 9%)" }}>
              <TrendingUp size={18} color="hsl(83 97% 59%)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(0 0% 90%)" }}>
                  {(stats.totalVolume / 1000).toFixed(0)}k lbs Total Volume
                </div>
                <div style={{ fontSize: 11, color: "hsl(0 0% 50%)" }}>Total weight moved across all sessions</div>
              </div>
            </div>
          )}
          {stats.avgEnergy !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid hsl(0 0% 15%)", background: "hsl(0 0% 9%)" }}>
              <Zap size={18} color="hsl(83 97% 59%)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(0 0% 90%)" }}>Avg Energy: {stats.avgEnergy}/5</div>
                <div style={{ fontSize: 11, color: "hsl(0 0% 50%)" }}>Average energy level across logged sessions</div>
              </div>
            </div>
          )}
          {stats.total >= 10 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid hsl(260 80% 60% / 0.2)", background: "hsl(260 80% 60% / 0.05)" }}>
              <span style={{ fontSize: 20 }}>🏆</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(0 0% 90%)" }}>{stats.total} Sessions Complete</div>
                <div style={{ fontSize: 11, color: "hsl(0 0% 50%)" }}>That's serious dedication. Keep it up!</div>
              </div>
            </div>
          )}
        </div>

        {sessions.length === 0 && (
          <div style={{ marginTop: 40, textAlign: "center", color: "hsl(0 0% 40%)" }}>
            <TrendingUp size={48} strokeWidth={1} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "hsl(0 0% 55%)" }}>No data yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Complete workouts to see your progress</div>
          </div>
        )}
      </div>

      {/* Weekly Recap sheet */}
      {showRecap && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div style={{ position: "absolute", inset: 0, background: "hsl(0 0% 0% / 0.65)" }} onClick={() => setShowRecap(false)} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "hsl(0 0% 8%)", borderRadius: "24px 24px 0 0", padding: "20px 20px 36px", maxHeight: "70vh", overflowY: "auto" as const }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Weekly Recap</div>
                <div style={{ fontSize: 12, color: "hsl(0 0% 50%)" }}>
                  {isoWeekStart(today).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              <button type="button" onClick={() => setShowRecap(false)} style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(0 0% 14%)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 60%)" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Workouts", value: weeklyRecap.count },
                { label: "New PRs", value: weeklyRecap.newPRs },
                { label: "Volume", value: `${(weeklyRecap.volume / 1000).toFixed(1)}k lbs` },
              ].map(({ label, value }) => (
                <div key={label} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: "1px solid hsl(0 0% 15%)", background: "hsl(0 0% 11%)", textAlign: "center" as const }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "hsl(83 97% 59%)" }}>{value}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "hsl(0 0% 50%)", marginTop: 2 }}>{label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            {weeklyRecap.splits.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "hsl(0 0% 55%)", marginBottom: 8 }}>SPLITS TRAINED</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                  {weeklyRecap.splits.map((s) => (
                    <span key={s} style={{ padding: "4px 12px", borderRadius: 99, background: "hsl(83 97% 59% / 0.15)", color: "hsl(83 97% 59%)", fontSize: 12, fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {weeklyRecap.count === 0 ? (
              <div style={{ padding: 16, borderRadius: 12, background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 16%)", fontSize: 14, color: "hsl(0 0% 60%)", textAlign: "center" as const }}>
                No completed workouts this week yet. The week isn't over — let's go! 💪
              </div>
            ) : (
              <div style={{ padding: 16, borderRadius: 12, background: "hsl(83 97% 59% / 0.07)", border: "1px solid hsl(83 97% 59% / 0.2)" }}>
                <div style={{ fontSize: 14, color: "hsl(0 0% 88%)", lineHeight: 1.6 }}>
                  {weeklyRecap.count >= 3 ? "🌟 Incredible week! " : weeklyRecap.count >= 1 ? "✅ Solid week! " : ""}
                  You completed <strong style={{ color: "hsl(83 97% 59%)" }}>{weeklyRecap.count} workout{weeklyRecap.count !== 1 ? "s" : ""}</strong> this week.
                  {weeklyRecap.newPRs > 0 && <> You hit <strong style={{ color: "hsl(43 96% 56%)" }}>{weeklyRecap.newPRs} new personal record{weeklyRecap.newPRs !== 1 ? "s" : ""}</strong>! 🏆</>}
                  {weeklyRecap.volume > 0 && <> Total volume lifted: <strong style={{ color: "hsl(83 97% 59%)" }}>{weeklyRecap.volume.toLocaleString()} lbs</strong>.</>}
                </div>
                <div style={{ marginTop: 12, fontSize: 13, color: "hsl(83 97% 59%)", fontStyle: "italic" }}>{weeklyRecap.msg}</div>
              </div>
            )}

            {stats.streak > 0 && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, border: "1px solid hsl(25 95% 55% / 0.2)", background: "hsl(25 95% 55% / 0.05)" }}>
                <Flame size={18} color="hsl(25 95% 55%)" />
                <span style={{ fontSize: 13, color: "hsl(0 0% 80%)" }}>Current streak: <strong style={{ color: "hsl(25 95% 55%)" }}>{stats.streak} day{stats.streak !== 1 ? "s" : ""}</strong></span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
