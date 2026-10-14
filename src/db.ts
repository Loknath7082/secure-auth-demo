import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

// ":memory:" is used by the test suite; a file path is used everywhere else.
if (config.DATABASE_PATH !== ":memory:") {
  mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });
}

export const db = new Database(config.DATABASE_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid        TEXT    PRIMARY KEY,
      data       TEXT    NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
      ON sessions (expires_at);
  `);
}

migrate();
