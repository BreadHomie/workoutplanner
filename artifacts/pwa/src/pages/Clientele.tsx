import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { UserPlus, Trash2, ChevronRight, Users } from "lucide-react";
import { db } from "../db/index";
import type { Client } from "../lib/types";

interface Props {
  onOpenClient: (clientId: number) => void;
}

export default function Clientele({ onOpenClient }: Props) {
  const clients = useLiveQuery(() => db.clients.orderBy("name").toArray(), []);
  const sessions = useLiveQuery(() => db.workoutSessions.toArray(), []);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await db.clients.add({
      name: trimmed,
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Client);
    setNewName("");
    setShowAdd(false);
  };

  const handleDelete = async (id: number) => {
    await db.clients.delete(id);
    setConfirmDelete(null);
  };

  const sessionCountForClient = (clientId: number) =>
    (sessions ?? []).filter((s) => s.clientId === clientId).length;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 16px 8px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(0 0% 95%)" }}>Clientele</div>
          <div style={{ fontSize: 13, color: "hsl(0 0% 50%)" }}>
            {clients?.length ?? 0} client{(clients?.length ?? 0) !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => { setShowAdd(true); setConfirmDelete(null); }}
          style={{ gap: 6 }}
        >
          <UserPlus size={15} />
          Add Client
        </button>
      </div>

      <div className="scroll-area" style={{ flex: 1, padding: "8px 16px 24px" }}>
        {/* Add form */}
        {showAdd && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 14, border: "1px solid hsl(83 97% 59% / 0.4)", background: "hsl(83 97% 59% / 0.05)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(0 0% 80%)", marginBottom: 10 }}>New Client</div>
            <input
              type="text"
              autoFocus
              placeholder="Client name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 10,
                border: "1px solid hsl(0 0% 20%)",
                background: "hsl(0 0% 12%)",
                color: "hsl(0 0% 92%)",
                padding: "0 12px",
                fontSize: 15,
                fontFamily: "inherit",
                marginBottom: 10,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAdd}
                disabled={!newName.trim()}
                style={{ flex: 1, minHeight: 40 }}
              >
                Add
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowAdd(false); setNewName(""); }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Client list */}
        {clients && clients.length === 0 && !showAdd && (
          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "hsl(0 0% 40%)", textAlign: "center" }}>
            <Users size={48} strokeWidth={1} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "hsl(0 0% 55%)" }}>No clients yet</div>
            <div style={{ fontSize: 13 }}>Tap "Add Client" to get started</div>
          </div>
        )}

        {clients && clients.map((client) => (
          <div key={client.id} style={{ marginBottom: 8 }}>
            {confirmDelete === client.id ? (
              <div style={{ padding: 14, borderRadius: 14, border: "1px solid hsl(0 72% 40% / 0.4)", background: "hsl(0 72% 51% / 0.06)" }}>
                <div style={{ fontSize: 14, color: "hsl(0 72% 65%)", marginBottom: 10 }}>
                  Remove <strong>{client.name}</strong>? This won't delete their workout history.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleDelete(client.id!)}
                    style={{ flex: 1, height: 38, borderRadius: 10, background: "hsl(0 72% 51%)", color: "white", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14 }}
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setConfirmDelete(null)}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="card"
                style={{ display: "flex", alignItems: "center", cursor: "pointer", padding: "14px 16px", gap: 12 }}
                onClick={() => onOpenClient(client.id!)}
              >
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  background: "hsl(83 97% 59% / 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "hsl(83 97% 59%)",
                  flexShrink: 0,
                }}>
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(0 0% 92%)" }}>{client.name}</div>
                  <div style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 2 }}>
                    {sessionCountForClient(client.id!)} session{sessionCountForClient(client.id!) !== 1 ? "s" : ""}
                    {client.notes ? " · Has notes" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(client.id!); setShowAdd(false); }}
                  style={{ width: 32, height: 32, borderRadius: 8, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(0 0% 40%)" }}
                >
                  <Trash2 size={16} />
                </button>
                <ChevronRight size={18} color="hsl(0 0% 35%)" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
