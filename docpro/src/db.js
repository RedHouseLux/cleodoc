import { openDB } from "idb";

export async function getDb() {
  return openDB("docpro_offline", 1, {
    upgrade(db) {
      db.createObjectStore("users", { keyPath: "id" });
      db.createObjectStore("entries", { keyPath: "id" });
      db.createObjectStore("queue_notes", { keyPath: "id" }); // offline notes to sync
      db.createObjectStore("meta", { keyPath: "key" });
    },
  });
}

export async function cacheUsers(users) {
  const db = await getDb();
  const tx = db.transaction("users", "readwrite");
  for (const u of users) tx.store.put(u);
  await tx.done;
}

export async function cacheEntries(entries) {
  const db = await getDb();
  const tx = db.transaction("entries", "readwrite");
  for (const e of entries) tx.store.put(e);
  await tx.done;
}

export async function listCachedUsers() {
  const db = await getDb();
  return db.getAll("users");
}

export async function listCachedEntriesByUser(userId) {
  const db = await getDb();
  const all = await db.getAll("entries");
  return all.filter((e) => e.user_id === userId && !e.deleted)
            .sort((a,b) => (a.ts < b.ts ? 1 : -1));
}

export async function setMeta(key, value) {
  const db = await getDb();
  await db.put("meta", { key, value });
}

export async function getMeta(key, fallback = null) {
  const db = await getDb();
  const r = await db.get("meta", key);
  return r ? r.value : fallback;
}

// Notes queue (offline-first pro writes)
export async function queueNote(noteObj) {
  const db = await getDb();
  await db.put("queue_notes", noteObj);
}

export async function getQueuedNotes() {
  const db = await getDb();
  return db.getAll("queue_notes");
}

export async function clearQueuedNotes(ids) {
  const db = await getDb();
  const tx = db.transaction("queue_notes", "readwrite");
  for (const id of ids) tx.store.delete(id);
  await tx.done;
}
