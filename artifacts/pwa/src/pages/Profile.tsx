import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Save, RotateCcw, Zap, Trophy, Flame } from "lucide-react";
import { db } from "../db/index";
import type { UserProfile } from "../lib/types";
import { SPLIT_CYCLES } from "../lib/workoutGenerator";

const EQUIPMENT_OPTIONS = ["Full Gym", "Bodyweight", "Dumbbells"];
const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const CADENCE_OPTIONS = [2, 3, 4, 5, 6];

export default function Profile() {
  const profile = useLiveQuery(() => db.userProfile.toCollection().first());
  const sessions = useLiveQuery(() => db.workoutSessions.toArray(), []);
  const logs = useLiveQuery(() => db.sessionLogs.toArray(), []);

  const [difficulty, setDifficulty] = useState("Intermediate");
  const [equipment, setEquipment] = useState<string[]>(["Full Gym", "Bodyweight", "Dumbbells"]);
  const [cadence, setCadence] = useState(3);
  const [split, setSplit] = useState("Full Body");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    if (profile) {
      setDifficulty(profile.difficultyLevel ?? "Intermediate");
      setEquipment(profile.equipment ?? ["Full Gym", "Bodyweight", "Dumbbells"]);
      setCadence(profile.targetCadence ?? 3);
      setSplit(profile.preferredSplit ?? "Full Body");
    }
  }, [profile?.id]);

  const completedSessions = sessions?.filter((s) => s.isCompleted) ?? [];
  const totalExercises = logs?.length ?? 0;
  const xp = profile?.totalXp ?? 0;
  const level = Math.floor(xp / 500) + 1;
  const xpProgress = (xp % 500) / 500;

  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setIsSaving(true);
    try {
      await db.userProfile.update(profile.id, {
        difficultyLevel: difficulty,
        equipment,
        targetCadence: cadence,
        preferredSplit: split,
        updatedAt: new Date().toISOString(),
      } as Partial<UserProfile>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    await db.workoutSessions.clear();
    await db.sessionLogs.clear();
    if (profile?.id) {
      await db.userProfile.update(profile.id, {
        totalXp: 0,
        totalCoins: 0,
        level: 1,
        updatedAt: new Date().toISOString(),
      });
    }
    setShowReset(false);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Profile</div>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>Your preferences & stats</div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <div className="stat-pill">
            <Trophy size={16} color="hsl(83 97% 59%)" style={{ marginBottom: 2 }} />
            <span className="stat-value">{completedSessions.length}</span>
            <span className="stat-label">Sessions</span>
          </div>
          <div className="stat-pill">
            <Flame size={16} color="hsl(83 97% 59%)" style={{ marginBottom: 2 }} />
            <span className="stat-value">{totalExercises}</span>
            <span className="stat-label">Sets</span>
          </div>
          <div className="stat-pill">
            <Zap size={16} color="hsl(83 97% 59%)" style={{ marginBottom: 2 }} />
            <span className="stat-value">{xp}</span>
            <span className="stat-label">XP</span>
          </div>
        </div>

        {/* Level */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "hsl(0 0% 70%)" }}>Level {level}</span>
            <span style={{ fontSize: 12, color: "hsl(0 0% 45%)" }}>{xp % 500} / 500 XP</span>
          </div>
          <div className="xp-bar-bg">
            <div className="xp-bar-fill" style={{ width: `${xpProgress * 100}%` }} />
          </div>
        </div>

        {/* Difficulty */}
        <div className="section-label">Difficulty</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {DIFFICULTY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`chip${difficulty === d ? " active" : ""}`}
              onClick={() => setDifficulty(d)}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Equipment */}
        <div className="section-label">Equipment Available</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {EQUIPMENT_OPTIONS.map((eq) => (
            <button
              key={eq}
              type="button"
              className={`chip${equipment.includes(eq) ? " active" : ""}`}
              onClick={() => toggleEquipment(eq)}
            >
              {eq}
            </button>
          ))}
        </div>

        {/* Split preference */}
        <div className="section-label">Preferred Split</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {Object.keys(SPLIT_CYCLES).map((key) => (
            <button
              key={key}
              type="button"
              className={`chip${split === key ? " active" : ""}`}
              onClick={() => setSplit(key)}
              style={{ justifyContent: "flex-start", borderRadius: 10, padding: "10px 14px" }}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Cadence */}
        <div className="section-label">Weekly Target (days/week)</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {CADENCE_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip${cadence === c ? " active" : ""}`}
              onClick={() => setCadence(c)}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Save */}
        <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
          <Save size={18} />
          {saved ? "Saved!" : isSaving ? "Saving…" : "Save Settings"}
        </button>

        {/* Reset */}
        <div style={{ marginTop: 32, borderTop: "1px solid hsl(0 0% 15%)", paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0 0% 60%)", marginBottom: 10 }}>Danger Zone</div>
          {showReset ? (
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid hsl(0 72% 40% / 0.4)", background: "hsl(0 72% 51% / 0.06)" }}>
              <div style={{ fontSize: 14, color: "hsl(0 72% 65%)", marginBottom: 12 }}>
                This will delete all workout history and reset your XP. Cannot be undone.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 10,
                    background: "hsl(0 72% 51%)",
                    color: "white",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Yes, Reset All
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowReset(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowReset(true)}
              style={{ width: "100%", color: "hsl(0 72% 60%)", borderColor: "hsl(0 72% 40% / 0.4)" }}
            >
              <RotateCcw size={16} />
              Reset All Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
