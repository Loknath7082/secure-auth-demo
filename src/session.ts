import type { Request } from "express";
import session from "express-session";
import { config, isProduction } from "./config.js";
import { SqliteSessionStore } from "./session-store.js";

/**
 * OWASP recommends the `__Host-` prefix for session cookies: it forces the
 * browser to require Secure + Path=/ and to reject any Domain attribute, which
 * makes cookie tossing harder. Browsers refuse `__Host-` cookies over plain
 * HTTP, so we only use it in production where TLS is mandatory.
 */
export const SESSION_COOKIE_NAME = isProduction ? "__Host-sid" : "sid";

export const sessionStore = new SqliteSessionStore();

type RequestHandler = ReturnType<typeof session>;

export function createSessionMiddleware(): RequestHandler {
  return session({
    name: SESSION_COOKIE_NAME,
    secret: config.SESSION_SECRET,
    store: sessionStore,

    // Do not re-save untouched sessions. Fetching a CSRF token modifies the
    // session, so anonymous visitors who call /api/csrf-token do get a session row.
    resave: false,
    saveUninitialized: false,

    // Slide the expiry forward on activity, so active users are not logged out
    // mid-session while idle sessions still expire.
    rolling: true,

    cookie: {
      httpOnly: true,     // not readable from JavaScript
      secure: isProduction, // HTTPS only in production
      sameSite: "lax",    // blocks cross-site POSTs; see the CSRF section
      path: "/",
      maxAge: config.SESSION_TTL_MS,
    },
  });
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}
