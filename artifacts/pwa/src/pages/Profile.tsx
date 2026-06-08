import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw, Plus, Search, X, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { db } from "../db/index";
import type { Exercise } from "../lib/types";
import { EQUIPMENT_OPTIONS, DIFFICULTY_OPTIONS, MUSCLE_FIELDS } from "../lib/types";

const EQUIPMENT_LIST = [...EQUIPMENT_OPTIONS];
const DIFF_LIST = [...DIFFICULTY_OPTIONS];

function ExerciseLibrary() {
  const exercises = useLiveQuery(() => db.exercises.orderBy("name").toArray(), []);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [newEx, setNewEx] = useState({
    name: "", equipment: "Full Gym", difficulty: "Intermediate" as Exercise["difficulty"],
    isCompound: false, hitChest: false, hitBack: false, hitLegs: false, hitCore: false, hitArm: false, hitShoulder: false,
  });

  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = search.toLowerCase().trim();
    return exercises.filter((ex) => {
      if (!showInactive && ex.isActive === false) return false;
      if (q && !ex.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, search, showInactive]);

  const activeCount = (exercises ?? []).filter((e) => e.isActive !== false).length;
  const inactiveCount = (exercises ?? []).filter((e) => e.isActive === false).length;

  const toggleActive = async (ex: Exercise) => {
    await db.exercises.update(ex.id, { isActive: ex.isActive === false ? true : false });
  };

  const handleAddExercise = async () => {
    if (!newEx.name.trim()) return;
    const hasMuscle = newEx.hitChest || newEx.hitBack || newEx.hitLegs || newEx.hitCore || newEx.hitArm || newEx.hitShoulder;
    if (!hasMuscle) return;
    await db.exercises.add({
      id: Date.now(),
      name: newEx.name.trim(),
      equipment: newEx.equipment,
      difficulty: newEx.difficulty,
      isCompound: newEx.isCompound,
      hitChest: newEx.hitChest,
      hitBack: newEx.hitBack,
      hitLegs: newEx.hitLegs,
      hitCore: newEx.hitCore,
      hitArm: newEx.hitArm,
      hitShoulder: newEx.hitShoulder,
      classification: "Custom",
      isActive: true,
    });
    setNewEx({ name: "", equipment: "Full Gym", difficulty: "Intermediate", isCompound: false, hitChest: false, hitBack: false, hitLegs: false, hitCore: false, hitArm: false, hitShoulder: false });
    setShowAdd(false);
  };

  return (
    <div>
      {/* Stats + controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>
          {activeCount} active{inactiveCount > 0 && ` · ${inactiveCount} hidden`}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {inactiveCount > 0 && (
            <button type="button" className="btn-secondary" onClick={() => setShowInactive((p) => !p)}
              style={{ height: 34, padding: "0 12px", fontSize: 12, gap: 4 }}>
              {showInactive ? <EyeOff size={13} /> : <Eye size={13} />}
              {showInactive ? "Hide inactive" : "Show all"}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => setShowAdd((p) => !p)}
            style={{ height: 34, padding: "0 12px", fontSize: 12, gap: 4 }}>
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ padding: 16, borderRadius: 14, border: "1px solid hsl(83 97% 59% / 0.3)", background: "hsl(83 97% 59% / 0.04)", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(0 0% 85%)", marginBottom: 12 }}>New Exercise</div>
          <input
            type="text" placeholder="Exercise name" value={newEx.name}
            onChange={(e) => setNewEx((p) => ({ ...p, name: e.target.value }))}
            style={{ width: "100%", height: 44, borderRadius: 10, border: "1px solid hsl(0 0% 20%)", background: "hsl(0 0% 12%)", color: "hsl(0 0% 92%)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <select value={newEx.equipment} onChange={(e) => setNewEx((p) => ({ ...p, equipment: e.target.value }))}
                style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 12%)", color: "hsl(0 0% 88%)", padding: "0 12px", fontSize: 13, fontFamily: "inherit", appearance: "none" as any }}>
                {EQUIPMENT_LIST.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, position: "relative" }}>
              <select value={newEx.difficulty} onChange={(e) => setNewEx((p) => ({ ...p, difficulty: e.target.value as Exercise["difficulty"] }))}
                style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 12%)", color: "hsl(0 0% 88%)", padding: "0 12px", fontSize: 13, fontFamily: "inherit", appearance: "none" as any }}>
                {DIFF_LIST.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 10 }}>
            {MUSCLE_FIELDS.map(({ key, label }) => (
              <button key={key} type="button"
                className={`chip${newEx[key as keyof typeof newEx] ? " active" : ""}`}
                onClick={() => setNewEx((p) => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                style={{ fontSize: 12, padding: "6px 12px" }}>
                {label}
              </button>
            ))}
            <button type="button"
              className={`chip${newEx.isCompound ? " active" : ""}`}
              onClick={() => setNewEx((p) => ({ ...p, isCompound: !p.isCompound }))}
              style={{ fontSize: 12, padding: "6px 12px" }}>
              Compound
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-primary" onClick={handleAddExercise}
              disabled={!newEx.name.trim()} style={{ flex: 1, minHeight: 40 }}>
              Add Exercise
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 10 }}>
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

      {/* Exercise list */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
        {filtered.map((ex) => {
          const isHidden = ex.isActive === false;
          const muscles = [
            ex.hitChest && "Chest", ex.hitBack && "Back", ex.hitLegs && "Legs",
            ex.hitCore && "Core", ex.hitArm && "Arms", ex.hitShoulder && "Shoulders",
          ].filter(Boolean).slice(0, 3) as string[];
          return (
            <div key={ex.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10,
              border: "1px solid hsl(0 0% 13%)", background: isHidden ? "hsl(0 0% 6%)" : "hsl(0 0% 9%)",
              opacity: isHidden ? 0.6 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0 0% 88%)", display: "flex", alignItems: "center", gap: 6 }}>
                  {ex.name}
                  {ex.classification === "Custom" && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: "hsl(83 97% 59% / 0.2)", color: "hsl(83 97% 59%)", padding: "1px 5px", borderRadius: 4, letterSpacing: "0.06em" }}>CUSTOM</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginTop: 3 }}>
                  {muscles.map((m) => (
                    <span key={m} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "hsl(83 97% 59% / 0.1)", color: "hsl(83 97% 59%)" }}>{m}</span>
                  ))}
                  <span style={{ fontSize: 10, color: "hsl(0 0% 40%)" }}>{ex.equipment}</span>
                </div>
              </div>
              <button type="button" onClick={() => toggleActive(ex)}
                style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "none", border: "1px solid hsl(0 0% 18%)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: isHidden ? "hsl(0 0% 45%)" : "hsl(83 97% 59%)" }}>
                {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "hsl(0 0% 40%)", fontSize: 13, padding: "24px 0" }}>
            {search ? "No exercises match that search" : "No exercises found"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const sessions = useLiveQuery(() => db.workoutSessions.toArray(), []);
  const clients = useLiveQuery(() => db.clients.toArray(), []);
  const [showReset, setShowReset] = useState(false);
  const [activeSection, setActiveSection] = useState<"exercises" | null>("exercises");

  const completedSessions = (sessions ?? []).filter((s) => s.isCompleted);

  const handleReset = async () => {
    await db.workoutSessions.clear();
    await db.sessionLogs.clear();
    setShowReset(false);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Settings</div>
        <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>Manage exercises and data</div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <div className="stat-pill">
            <span className="stat-value">{completedSessions.length}</span>
            <span className="stat-label">Sessions</span>
          </div>
          <div className="stat-pill">
            <span className="stat-value">{clients?.length ?? 0}</span>
            <span className="stat-label">Clients</span>
          </div>
        </div>

        {/* Exercises section */}
        <button type="button"
          onClick={() => setActiveSection((p) => p === "exercises" ? null : "exercises")}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 12 }}>
          <div className="section-label" style={{ margin: 0 }}>Exercise Library</div>
          {activeSection === "exercises" ? <ChevronUp size={16} color="hsl(0 0% 50%)" /> : <ChevronDown size={16} color="hsl(0 0% 50%)" />}
        </button>
        {activeSection === "exercises" && <ExerciseLibrary />}

        {/* Reset */}
        <div style={{ marginTop: 32, borderTop: "1px solid hsl(0 0% 14%)", paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0 0% 55%)", marginBottom: 10 }}>Danger Zone</div>
          {showReset ? (
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid hsl(0 72% 40% / 0.4)", background: "hsl(0 72% 51% / 0.06)" }}>
              <div style={{ fontSize: 14, color: "hsl(0 72% 65%)", marginBottom: 12 }}>
                This will delete all workout sessions and saved weights. Client profiles and notes will remain.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleReset} style={{ flex: 1, height: 40, borderRadius: 10, background: "hsl(0 72% 51%)", color: "white", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
                  Yes, Reset
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowReset(false)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setShowReset(true)} style={{ width: "100%", color: "hsl(0 72% 60%)", borderColor: "hsl(0 72% 40% / 0.4)" }}>
              <RotateCcw size={16} /> Reset All Workout Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
