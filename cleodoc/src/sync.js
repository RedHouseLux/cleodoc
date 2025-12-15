import { getPendingEntries, markSynced } from "./db";

const API_BASE = (process.env.EXPO_PUBLIC_CENTRAL_API_BASE || "").replace(/\/+$/, "");
const MOBILE_KEY = "mobilesetup";               // same as Heroku config var

export async function syncNow({ userId, label = "CLEODOC User" }) {
  const pending = await getPendingEntries();
  if (!pending.length) return { ok: true, synced: 0 };

  const payload = {
    user: {
      id: userId,
      label,
      consent: { share_with_professional: true },
    },
    entries: pending.map((e) => ({
      id: e.id,
      ts: e.ts,
      mood: e.mood,
      stress: e.stress,
      note: e.note,
      last_modified: e.last_modified,
      deleted: !!e.deleted,
    })),
  };

  const res = await fetch(`${API_BASE}/api/cleodoc/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MOBILE-KEY": MOBILE_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    return { ok: false, error: txt };
  }

  const json = await res.json();
  await markSynced(json.synced_entry_ids || []);
  return { ok: true, synced: (json.synced_entry_ids || []).length };
}
