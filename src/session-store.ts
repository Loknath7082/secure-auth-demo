import session from "express-session";
import type { SessionData } from "express-session";
import { config } from "./config.js";
import { db } from "./db.js";

interface SessionRow {
  data: string;
  expires_at: number;
}

export class SqliteSessionStore extends session.Store {
  override get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
    try {
      const row = db
        .prepare("SELECT data, expires_at FROM sessions WHERE sid = ?")
        .get(sid) as SessionRow | undefined;

      if (!row) {
        callback(null, null);
        return;
      }

      if (row.expires_at <= Date.now()) {
        // Expired sessions are deleted lazily, on the next read.
        this.destroy(sid, () => callback(null, null));
        return;
      }

      callback(null, JSON.parse(row.data) as SessionData);
    } catch (error) {
      callback(error);
    }
  }

  override set(sid: string, sessionData: SessionData, callback?: (err?: unknown) => void): void {
    try {
      const expiresAt = this.expiresAtFor(sessionData);
      db.prepare(
        `INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
         ON CONFLICT (sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`,
      ).run(sid, JSON.stringify(sessionData), expiresAt);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  override touch(sid: string, sessionData: SessionData, callback?: (err?: unknown) => void): void {
    try {
      db.prepare("UPDATE sessions SET expires_at = ? WHERE sid = ?").run(
        this.expiresAtFor(sessionData),
        sid,
      );
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  /** Removes every expired row. Useful as a periodic cleanup job. */
  pruneExpired(): number {
    return db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now()).changes;
  }

  private expiresAtFor(sessionData: SessionData): number {
    const { expires, maxAge } = sessionData.cookie ?? {};
    if (expires) {
      return new Date(expires).getTime();
    }
    if (typeof maxAge === "number") {
      return Date.now() + maxAge;
    }
    return Date.now() + config.SESSION_TTL_MS;
  }
}
