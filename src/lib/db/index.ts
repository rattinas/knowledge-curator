import Database from 'better-sqlite3';
import path from 'path';
import { initSchema } from './schema';

let db: Database.Database | null = null;
let keysLoaded = false;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(process.cwd(), 'data', 'knowledge-curator.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);

  // Load API keys from DB into process.env on first connection
  if (!keysLoaded) {
    keysLoaded = true;
    try {
      const { loadApiKeysIntoEnv } = require('./queries');
      loadApiKeysIntoEnv();
    } catch { /* queries not ready yet during schema init */ }
  }

  return db;
}
