import * as SQLite from "expo-sqlite";
import { v4 as uuidv4 } from "uuid";

const db = SQLite.openDatabase("cleodoc_local.db");

export function initDb() {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS user_profile (
          id TEXT PRIMARY KEY NOT NULL,
          created_at INTEGER NOT NULL
        );`
      );
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          ts TEXT NOT NULL,
          mood INTEGER,
          stress INTEGER,
          note TEXT,
          last_modified TEXT NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0,
          sync_status TEXT NOT NULL DEFAULT 'pending'
        );`,
        [],
        () => resolve(),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function getOrCreateUserId() {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        "SELECT id FROM user_profile LIMIT 1;",
        [],
        (_, res) => {
          if (res.rows.length > 0) return resolve(res.rows.item(0).id);

          const id = uuidv4();
          const createdAt = Date.now();
          tx.executeSql(
            "INSERT INTO user_profile (id, created_at) VALUES (?, ?);",
            [id, createdAt],
            () => resolve(id),
            (_, err) => { reject(err); return false; }
          );
        },
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function insertEntry({ userId, mood, stress, note }) {
  const id = uuidv4();
  const ts = new Date().toISOString();
  const lastModified = ts;

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `INSERT INTO entries
        (id, user_id, ts, mood, stress, note, last_modified, deleted, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending');`,
        [id, userId, ts, mood, stress, note, lastModified],
        () => resolve({ id, ts }),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function listEntries(limit = 50) {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        "SELECT * FROM entries WHERE deleted=0 ORDER BY ts DESC LIMIT ?;",
        [limit],
        (_, res) => resolve(res.rows._array),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function getPendingEntries() {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        "SELECT * FROM entries WHERE sync_status != 'synced' ORDER BY last_modified ASC LIMIT 200;",
        [],
        (_, res) => resolve(res.rows._array),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function markSynced(entryIds = []) {
  if (!entryIds.length) return Promise.resolve();

  const placeholders = entryIds.map(() => "?").join(",");
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `UPDATE entries SET sync_status='synced' WHERE id IN (${placeholders});`,
        entryIds,
        () => resolve(),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}
