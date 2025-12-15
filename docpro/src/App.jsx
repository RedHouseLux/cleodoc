import React, { useEffect, useState } from "react";
import { listCachedUsers, listCachedEntriesByUser, queueNote } from "./db";
import { syncUsers, syncEntriesForUser, syncQueuedNotes } from "./api";

function makeId() {
  // Works in modern browsers + Electron
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Fallback (still unique enough for local queued notes)
  return `note_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function errMsg(e) {
  return e instanceof Error ? e.message : String(e);
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [entries, setEntries] = useState([]);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const [profEmail, setProfEmail] = useState("pro@example.com");

  async function refreshLocal(nextSelected = selected) {
    const u = await listCachedUsers();
    setUsers(u);

    if (nextSelected) {
      const e = await listCachedEntriesByUser(nextSelected);
      setEntries(e);
    } else {
      setEntries([]);
    }
  }

  useEffect(() => {
    refreshLocal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 20, fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0 }}>DOCPRO</h1>
      <p style={{ opacity: 0.7, marginTop: 6 }}>Offline-first professional dashboard (PWA)</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <button
          onClick={async () => {
            try {
              setMsg("Syncing users...");
              await syncUsers();
              await refreshLocal();
              setMsg("Users synced.");
            } catch (e) {
              setMsg("Sync users failed (offline ok): " + errMsg(e));
            }
          }}
        >
          Sync users
        </button>

        <button
          disabled={!selected}
          onClick={async () => {
            try {
              setMsg("Syncing entries...");
              await syncEntriesForUser(selected);
              await refreshLocal();
              setMsg("Entries synced.");
            } catch (e) {
              setMsg("Sync entries failed (offline ok): " + errMsg(e));
            }
          }}
        >
          Sync entries for selected user
        </button>

        <input
          value={profEmail}
          onChange={(e) => setProfEmail(e.target.value)}
          placeholder="Professional email"
          style={{ padding: 6, minWidth: 220 }}
        />

        <button
          onClick={async () => {
            try {
              setMsg("Syncing queued notes...");
              const n = await syncQueuedNotes(profEmail);
              await refreshLocal();
              setMsg(`Queued notes synced: ${n}`);
            } catch (e) {
              setMsg("Sync notes failed (offline ok): " + errMsg(e));
            }
          }}
        >
          Sync queued notes
        </button>
      </div>

      {!!msg && <div style={{ marginTop: 12 }}>{msg}</div>}

      <hr style={{ margin: "18px 0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18 }}>
        <div>
          <h3>Users (cached offline)</h3>
          <div style={{ border: "1px solid #ddd", borderRadius: 8 }}>
            {users.map((u) => (
              <div
                key={u.id}
                onClick={() => setSelected(u.id)}
                style={{
                  padding: 10,
                  cursor: "pointer",
                  background: selected === u.id ? "#f3f3f3" : "white",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 700 }}>{u.label || "Unnamed user"}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{u.id}</div>
              </div>
            ))}
            {!users.length && <div style={{ padding: 10, opacity: 0.7 }}>No cached users yet.</div>}
          </div>
        </div>

        <div>
          <h3>Timeline {selected ? `(user: ${selected.slice(0, 8)}...)` : ""}</h3>

          {selected && (
            <div style={{ marginBottom: 12 }}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write a note offline (queued until sync)…"
                style={{ width: "100%", minHeight: 80, padding: 10 }}
              />
              <button
                onClick={async () => {
                  if (!note.trim()) return;

                  await queueNote({
                    id: makeId(),
                    user_id: selected,
                    ts: new Date().toISOString(),
                    note: note.trim(),
                    last_modified: new Date().toISOString(),
                    deleted: false,
                  });

                  setNote("");
                  await refreshLocal();
                  setMsg("Note saved offline (queued).");
                }}
              >
                Save note offline
              </button>
            </div>
          )}

          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
            {entries.map((e) => (
              <div key={e.id} style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                <div style={{ fontWeight: 700 }}>
                  {e.ts ? new Date(e.ts).toLocaleString() : "(no timestamp)"}
                </div>
                <div>Mood: {e.mood ?? "-"} | Stress: {e.stress ?? "-"}</div>
                <div style={{ opacity: 0.8 }}>{e.note}</div>
              </div>
            ))}
            {!entries.length && <div style={{ opacity: 0.7 }}>No cached entries yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
