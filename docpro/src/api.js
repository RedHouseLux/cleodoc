// src/api.js
import {
  cacheUsers,
  cacheEntries,
  getMeta,
  setMeta,
  getQueuedNotes,
  clearQueuedNotes,
} from "./db";

// ✅ HARD fallback for the packaged app (Electron/file://) when VITE env is empty in app.asar
const DEFAULT_API_BASE =
  "https://docpro-central-backend-b577b145d225.herokuapp.com";

// Use Vite env if present, otherwise fallback (then trim trailing slashes)
const API_BASE = String(import.meta.env.VITE_CENTRAL_API_BASE || DEFAULT_API_BASE)
  .trim()
  .replace(/\/+$/, "");

function assertBase() {
  // ✅ no “missing env” crash in packaged build
  if (!API_BASE) throw new Error("API_BASE is empty (unexpected).");
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}: ` + (text || "").slice(0, 250));
  }

  // Some environments throw on empty body; safeguard:
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(`Expected JSON but got ${ct || "unknown"}: ` + text.slice(0, 250));
  }

  return res.json();
}

export async function syncUsers() {
  assertBase();
  const json = await fetchJson(`${API_BASE}/api/central/users`);
  const users = Array.isArray(json) ? json : json.users || [];
  await cacheUsers(users);
}

export async function syncEntriesForUser(userId) {
  assertBase();

  // incremental sync cursor
  const key = `since_entries_${userId}`;
  const since = await getMeta(key, null);

  const url = new URL(`${API_BASE}/api/central/entries`);
  url.searchParams.set("user_id", userId);
  if (since) url.searchParams.set("since", since);

  const json = await fetchJson(url.toString());
  const entries = Array.isArray(json) ? json : json.entries || [];

  if (entries.length) {
    await cacheEntries(entries);

    // advance cursor to newest last_modified we received
    const newest = entries.reduce((m, e) => {
      const lm = e?.last_modified || "";
      return lm > m ? lm : m; // ISO strings compare fine
    }, since || "1970-01-01T00:00:00Z");

    await setMeta(key, newest);
  }
}

/**
 * Push queued notes to central backend.
 * We map notes -> CentralEntry rows (mood/stress can be null).
 * We group by user_id because /sync_entries expects one user per request.
 */
export async function syncQueuedNotes(professionalEmail) {
  assertBase();

  const queued = await getQueuedNotes();
  if (!queued.length) return 0;

  // group notes by user_id
  const byUser = new Map();
  for (const n of queued) {
    const uid = n.user_id;
    if (!uid) continue;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(n);
  }

  const allSyncedIds = [];

  for (const [userId, notes] of byUser.entries()) {
    // convert queued notes -> entries payload
    const entries = notes.map((n) => ({
      id: n.id,
      ts: n.ts,
      mood: n.mood ?? null,
      stress: n.stress ?? null,
      deleted: Boolean(n.deleted ?? false),
      last_modified: n.last_modified || n.ts,
      note: professionalEmail
        ? `[DOCPRO:${professionalEmail}] ${n.note || ""}`.trim()
        : (n.note || "").trim(),
    }));

    const json = await fetchJson(`${API_BASE}/api/central/sync_entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: { id: userId },
        entries,
      }),
    });

    const syncedIds = json?.synced_entry_ids || [];
    allSyncedIds.push(...syncedIds);
  }

  if (allSyncedIds.length) {
    await clearQueuedNotes(allSyncedIds);
  }

  return allSyncedIds.length;
}
