import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Plus, Search, X, Eye, EyeOff } from "lucide-react";
import { db } from "../db/index";
import type { Exercise } from "../lib/types";
import { EQUIPMENT_OPTIONS, DIFFICULTY_OPTIONS, MUSCLE_FIELDS } from "../lib/types";

interface Props {
  onBack: () => void;
}

const EQUIPMENT_LIST = [...EQUIPMENT_OPTIONS];
const DIFF_LIST = [...DIFFICULTY_OPTIONS];

export default function ExerciseLibrary({ onBack }: Props) {
  const exercises = useLiveQuery(
    () => db.exercises.toArray().then((arr) => arr.sort((a, b) => a.name.localeCompare(b.name))),
    []
  );

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
      hitChest: newEx.hitChest, hitBack: newEx.hitBack, hitLegs: newEx.hitLegs,
      hitCore: newEx.hitCore, hitArm: newEx.hitArm, hitShoulder: newEx.hitShoulder,
      classification: "Custom", isActive: true,
    });
    setNewEx({ name: "", equipment: "Full Gym", difficulty: "Intermediate", isCompound: false, hitChest: false, hitBack: false, hitLegs: false, hitCore: false, hitArm: false, hitShoulder: false });
    setShowAdd(false);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid hsl(0 0% 12%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={onBack}
            style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(0 0% 13%)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 70%)", flexShrink: 0 }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Exercise Library</div>
            <div style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 1 }}>{activeCount} active{inactiveCount > 0 ? ` · ${inactiveCount} hidden` : ""}</div>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setShowAdd((p) => !p)} style={{ height: 36, padding: "0 14px", fontSize: 13, gap: 5 }}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "12px 16px 24px" }}>
        {/* Add exercise form */}
        {showAdd && (
          <div style={{ padding: 16, borderRadius: 14, border: "1px solid hsl(83 97% 59% / 0.3)", background: "hsl(83 97% 59% / 0.04)", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(0 0% 85%)", marginBottom: 12 }}>New Exercise</div>
            <input
              type="text" placeholder="Exercise name" value={newEx.name}
              onChange={(e) => setNewEx((p) => ({ ...p, name: e.target.value }))}
              style={{ width: "100%", height: 44, borderRadius: 10, border: "1px solid hsl(0 0% 20%)", background: "hsl(0 0% 12%)", color: "hsl(0 0% 92%)", padding: "0 12px", fontSize: 14, fontFamily: "inherit", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <select value={newEx.equipment} onChange={(e) => setNewEx((p) => ({ ...p, equipment: e.target.value }))}
                style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 12%)", color: "hsl(0 0% 88%)", padding: "0 10px", fontSize: 13, fontFamily: "inherit", appearance: "none" as any }}>
                {EQUIPMENT_LIST.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={newEx.difficulty} onChange={(e) => setNewEx((p) => ({ ...p, difficulty: e.target.value as Exercise["difficulty"] }))}
                style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 12%)", color: "hsl(0 0% 88%)", padding: "0 10px", fontSize: 13, fontFamily: "inherit", appearance: "none" as any }}>
                {DIFF_LIST.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 10 }}>
              {MUSCLE_FIELDS.map(({ key, label }) => (
                <button key={key} type="button"
                  className={`chip${newEx[key as keyof typeof newEx] ? " active" : ""}`}
                  onClick={() => setNewEx((p) => ({ ...p, [key]: !(p as any)[key] }))}
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
              <button type="button" className="btn-primary" onClick={handleAddExercise} disabled={!newEx.name.trim()} style={{ flex: 1, minHeight: 40 }}>
                Add Exercise
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Search + show inactive toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ position: "relative", flex: 1 }}>
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
          {inactiveCount > 0 && (
            <button type="button" className="btn-secondary" onClick={() => setShowInactive((p) => !p)}
              style={{ height: 40, padding: "0 12px", fontSize: 12, gap: 4, flexShrink: 0 }}>
              {showInactive ? <EyeOff size={13} /> : <Eye size={13} />}
              {showInactive ? "Hide" : "Show all"}
            </button>
          )}
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
                display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10,
                border: "1px solid hsl(0 0% 13%)", background: isHidden ? "hsl(0 0% 6%)" : "hsl(0 0% 9%)",
                opacity: isHidden ? 0.55 : 1,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0 0% 88%)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                    {ex.name}
                    {ex.classification === "Custom" && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: "hsl(83 97% 59% / 0.2)", color: "hsl(83 97% 59%)", padding: "1px 5px", borderRadius: 4, letterSpacing: "0.06em" }}>CUSTOM</span>
                    )}
                    {ex.isCompound && (
                      <span style={{ fontSize: 9, color: "hsl(0 0% 40%)", background: "hsl(0 0% 14%)", padding: "1px 5px", borderRadius: 4 }}>COMPOUND</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginTop: 3 }}>
                    {muscles.map((m) => (
                      <span key={m} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "hsl(83 97% 59% / 0.1)", color: "hsl(83 97% 59%)" }}>{m}</span>
                    ))}
                    <span style={{ fontSize: 10, color: "hsl(0 0% 40%)" }}>{ex.equipment} · {ex.difficulty}</span>
                  </div>
                </div>
                <button type="button" onClick={() => toggleActive(ex)}
                  style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: "none", border: "1px solid hsl(0 0% 18%)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: isHidden ? "hsl(0 0% 40%)" : "hsl(83 97% 59%)" }}
                  title={isHidden ? "Show in workouts" : "Hide from workouts"}>
                  {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", color: "hsl(0 0% 40%)", fontSize: 13, padding: "32px 0" }}>
              {search ? "No exercises match that search" : "No exercises found"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
