import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw, BookOpen, ChevronRight } from "lucide-react";
import { db } from "../db/index";

interface Props {
  onOpenExerciseLibrary: () => void;
}

export default function Profile({ onOpenExerciseLibrary }: Props) {
  const sessions = useLiveQuery(() => db.workoutSessions.toArray(), []);
  const clients = useLiveQuery(() => db.clients.toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [showReset, setShowReset] = useState(false);
  const [showHardReset, setShowHardReset] = useState(false);

  const completedSessions = (sessions ?? []).filter((s) => s.isCompleted);
  const activeExercises = (exercises ?? []).filter((e) => e.isActive !== false).length;

  const handleSoftReset = async () => {
    await db.workoutSessions.clear();
    await db.sessionLogs.clear();
    setShowReset(false);
  };

  const handleHardReset = async () => {
    await db.workoutSessions.clear();
    await db.sessionLogs.clear();
    await db.clients.clear();
    await db.schedule.clear();
    await db.userProfile.clear();
    // Restore exercises to default (re-seed)
    await db.exercises.toCollection().modify((ex: any) => { ex.isActive = true; });
    setShowHardReset(false);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Settings</div>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>Manage your data</div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <div className="stat-pill">
            <span className="stat-value">{completedSessions.length}</span>
            <span className="stat-label">Sessions</span>
          </div>
          <div className="stat-pill">
            <span className="stat-value">{clients?.length ?? 0}</span>
            <span className="stat-label">Clients</span>
          </div>
          <div className="stat-pill">
            <span className="stat-value">{activeExercises}</span>
            <span className="stat-label">Exercises</span>
          </div>
        </div>

        {/* Exercise Library button */}
        <div style={{ marginBottom: 8 }}>
          <div className="section-label">Exercise Library</div>
          <button
            type="button"
            onClick={onOpenExerciseLibrary}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 16px", borderRadius: 14, border: "1px solid hsl(0 0% 16%)",
              background: "hsl(0 0% 9%)", cursor: "pointer", textAlign: "left" as const,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "hsl(83 97% 59% / 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={18} color="hsl(83 97% 59%)" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(0 0% 90%)" }}>Go to Exercise Library</div>
                <div style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 2 }}>Add, remove, or manage exercises</div>
              </div>
            </div>
            <ChevronRight size={18} color="hsl(0 0% 40%)" />
          </button>
        </div>

        {/* Danger Zone */}
        <div style={{ marginTop: 32, borderTop: "1px solid hsl(0 0% 14%)", paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0 0% 55%)", marginBottom: 12 }}>Data Management</div>

          {/* Soft reset — workouts only */}
          {showReset ? (
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid hsl(0 72% 40% / 0.4)", background: "hsl(0 72% 51% / 0.06)", marginBottom: 10 }}>
              <div style={{ fontSize: 14, color: "hsl(0 72% 65%)", marginBottom: 12 }}>
                This will delete all workout sessions and saved weights. Clients and exercises will remain.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleSoftReset} style={{ flex: 1, height: 40, borderRadius: 10, background: "hsl(0 72% 51%)", color: "white", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
                  Yes, Reset
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowReset(false)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => { setShowReset(true); setShowHardReset(false); }}
              style={{ width: "100%", color: "hsl(0 72% 60%)", borderColor: "hsl(0 72% 40% / 0.4)", marginBottom: 10 }}>
              <RotateCcw size={16} /> Reset Workout Data
            </button>
          )}

          {/* Hard reset — everything */}
          {showHardReset ? (
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid hsl(0 72% 40% / 0.6)", background: "hsl(0 72% 51% / 0.1)" }}>
              <div style={{ fontSize: 14, color: "hsl(0 72% 65%)", fontWeight: 700, marginBottom: 6 }}>⚠ Hard Reset</div>
              <div style={{ fontSize: 13, color: "hsl(0 72% 60%)", marginBottom: 12 }}>
                This will delete ALL data — sessions, clients, schedules, and exercise customizations. Cannot be undone.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleHardReset} style={{ flex: 1, height: 40, borderRadius: 10, background: "hsl(0 72% 40%)", color: "white", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
                  Hard Reset Everything
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowHardReset(false)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => { setShowHardReset(true); setShowReset(false); }}
              style={{ width: "100%", color: "hsl(0 72% 50%)", borderColor: "hsl(0 72% 35% / 0.5)", opacity: 0.85 }}>
              Hard Reset Everything
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
