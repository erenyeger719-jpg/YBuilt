import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATABASE_FILE = process.env.DATABASE_FILE || './data/app.db';

// Ensure data directory exists
const dbDir = path.dirname(path.resolve(DATABASE_FILE));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create singleton SQLite instance
export const db = new Database(DATABASE_FILE);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Typed helper for running statements (INSERT, UPDATE, DELETE)
 */
export function run<T = any>(sql: string, params?: any[]): Database.RunResult {
  const stmt = db.prepare(sql);
  return stmt.run(...(params || []));
}

/**
 * Typed helper for getting single row
 */
export function get<T = any>(sql: string, params?: any[]): T | undefined {
  const stmt = db.prepare(sql);
  return stmt.get(...(params || [])) as T | undefined;
}

/**
 * Typed helper for getting multiple rows
 */
export function all<T = any>(sql: string, params?: any[]): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...(params || [])) as T[];
}

/**
 * Transaction helper
 */
export function transaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}

/**
 * Close database connection
 */
export function close(): void {
  db.close();
}

export default db;
