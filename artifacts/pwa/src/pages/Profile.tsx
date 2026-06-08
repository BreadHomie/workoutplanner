import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw, BookOpen, ChevronRight, Download, Upload } from "lucide-react";
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
  const [exportStatus, setExportStatus] = useState<"idle" | "done" | "error">("idle");
  const [importStatus, setImportStatus] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    await db.dayNotes.clear();
    await db.exercises.toCollection().modify((ex: any) => { ex.isActive = true; });
    setShowHardReset(false);
  };

  const handleExport = async () => {
    try {
      const [exArr, sessArr, logsArr, profileArr, schedArr, clientArr, notesArr] = await Promise.all([
        db.exercises.toArray(),
        db.workoutSessions.toArray(),
        db.sessionLogs.toArray(),
        db.userProfile.toArray(),
        db.schedule.toArray(),
        db.clients.toArray(),
        db.dayNotes.toArray(),
      ]);
      const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        exercises: exArr,
        workoutSessions: sessArr,
        sessionLogs: logsArr,
        userProfile: profileArr,
        schedule: schedArr,
        clients: clientArr,
        dayNotes: notesArr,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `glide-fitness-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus("done");
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch { setExportStatus("error"); }
  };

  const handleImport = async (file: File) => {
    setImportStatus("importing");
    setImportError("");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.workoutSessions && !data.clients) throw new Error("Unrecognised file format");

      await db.transaction("rw", [db.workoutSessions, db.sessionLogs, db.clients, db.schedule, db.userProfile, db.dayNotes, db.exercises], async () => {
        if (data.workoutSessions?.length) { await db.workoutSessions.clear(); await db.workoutSessions.bulkPut(data.workoutSessions); }
        if (data.sessionLogs?.length) { await db.sessionLogs.clear(); await db.sessionLogs.bulkPut(data.sessionLogs); }
        if (data.clients?.length) { await db.clients.clear(); await db.clients.bulkPut(data.clients); }
        if (data.schedule?.length) { await db.schedule.clear(); await db.schedule.bulkPut(data.schedule); }
        if (data.userProfile?.length) { await db.userProfile.clear(); await db.userProfile.bulkPut(data.userProfile); }
        if (data.dayNotes?.length) { await db.dayNotes.clear(); await db.dayNotes.bulkPut(data.dayNotes); }
        if (data.exercises?.length) {
          // Only restore custom exercises + preserve isActive flags for existing
          const customExercises = data.exercises.filter((e: any) => e.classification === "Custom");
          if (customExercises.length) await db.exercises.bulkPut(customExercises);
          // Restore isActive flags for all
          for (const ex of data.exercises) {
            if (ex.isActive === false) await db.exercises.update(ex.id, { isActive: false });
          }
        }
      });
      setImportStatus("done");
      setTimeout(() => setImportStatus("idle"), 3000);
    } catch (err) {
      setImportStatus("error");
      setImportError(err instanceof Error ? err.message : "Import failed");
    }
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
          {[
            { label: "Sessions", value: completedSessions.length },
            { label: "Clients", value: clients?.length ?? 0 },
            { label: "Exercises", value: activeExercises },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: "1px solid hsl(0 0% 15%)", background: "hsl(0 0% 9%)", textAlign: "center" as const }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(83 97% 59%)" }}>{value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "hsl(0 0% 50%)", marginTop: 2 }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Exercise Library */}
        <div className="section-label">Exercise Library</div>
        <button type="button" onClick={onOpenExerciseLibrary}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px", borderRadius: 14, border: "1px solid hsl(0 0% 16%)", background: "hsl(0 0% 9%)", cursor: "pointer", textAlign: "left" as const, marginBottom: 20 }}>
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

        {/* Export / Import */}
        <div className="section-label">Data Backup</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button type="button" onClick={handleExport}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 12px", borderRadius: 12, border: "1px solid hsl(0 0% 18%)", background: exportStatus === "done" ? "hsl(83 97% 59% / 0.12)" : "hsl(0 0% 9%)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13, color: exportStatus === "done" ? "hsl(83 97% 59%)" : "hsl(0 0% 75%)" }}>
            <Download size={16} />
            {exportStatus === "done" ? "Exported!" : exportStatus === "error" ? "Export failed" : "Export Data"}
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 12px", borderRadius: 12, border: "1px solid hsl(0 0% 18%)", background: importStatus === "done" ? "hsl(83 97% 59% / 0.12)" : "hsl(0 0% 9%)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13, color: importStatus === "done" ? "hsl(83 97% 59%)" : "hsl(0 0% 75%)" }}>
            <Upload size={16} />
            {importStatus === "importing" ? "Importing…" : importStatus === "done" ? "Imported!" : "Import Data"}
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
        </div>
        {importStatus === "error" && importError && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "hsl(0 72% 51% / 0.1)", color: "hsl(0 72% 65%)", fontSize: 13, marginBottom: 16 }}>
            ⚠ {importError}
          </div>
        )}
        {importStatus === "done" && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "hsl(83 97% 59% / 0.08)", color: "hsl(83 97% 59%)", fontSize: 13, marginBottom: 16 }}>
            ✓ Data imported successfully. The app will reflect the new data.
          </div>
        )}
        <div style={{ fontSize: 11, color: "hsl(0 0% 35%)", marginBottom: 24, lineHeight: 1.5 }}>
          Export saves all your workouts, clients, and progress to a JSON file. Import that file on any device to restore.
        </div>

        {/* Reset */}
        <div style={{ borderTop: "1px solid hsl(0 0% 14%)", paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0 0% 55%)", marginBottom: 12 }}>Data Management</div>

          {showReset ? (
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid hsl(0 72% 40% / 0.4)", background: "hsl(0 72% 51% / 0.06)", marginBottom: 10 }}>
              <div style={{ fontSize: 14, color: "hsl(0 72% 65%)", marginBottom: 12 }}>Delete all workout sessions and saved weights? Clients and exercises stay.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleSoftReset} style={{ flex: 1, height: 40, borderRadius: 10, background: "hsl(0 72% 51%)", color: "white", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>Yes, Reset</button>
                <button type="button" className="btn-secondary" onClick={() => setShowReset(false)} style={{ flex: 1 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => { setShowReset(true); setShowHardReset(false); }}
              style={{ width: "100%", color: "hsl(0 72% 60%)", borderColor: "hsl(0 72% 40% / 0.4)", marginBottom: 10 }}>
              <RotateCcw size={16} /> Reset Workout Data
            </button>
          )}

          {showHardReset ? (
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid hsl(0 72% 40% / 0.6)", background: "hsl(0 72% 51% / 0.1)" }}>
              <div style={{ fontSize: 14, color: "hsl(0 72% 65%)", fontWeight: 700, marginBottom: 6 }}>⚠ Hard Reset</div>
              <div style={{ fontSize: 13, color: "hsl(0 72% 60%)", marginBottom: 12 }}>Deletes ALL data — sessions, clients, schedules, exercise customizations. Cannot be undone.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleHardReset} style={{ flex: 1, height: 40, borderRadius: 10, background: "hsl(0 72% 40%)", color: "white", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>Hard Reset Everything</button>
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
