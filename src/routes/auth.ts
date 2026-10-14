import { Router } from "express";
import { z } from "zod";
import { isProduction } from "../config.js";
import { hashPassword, verifyPassword } from "../password.js";
import { requireAuth, currentUserId } from "../middleware/require-auth.js";
import {
  SESSION_COOKIE_NAME,
  destroySession,
  regenerateSession,
  saveSession,
} from "../session.js";
import { findUserByEmail, findUserById, insertUser } from "../users.js";

export const authRouter = Router();

/** Normalise the email before validating it, so case never creates duplicates. */
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

const registerSchema = z.object({
  email: emailSchema,
  // Length matters more than character-class rules. NIST SP 800-63B recommends
  // allowing long passphrases; we require at least 12 characters and cap the
  // length so a huge body cannot be used to burn CPU.
  password: z.string().min(12).max(200),
});

// Login must not re-apply the registration policy: doing so would leak the
// policy and lock out accounts created before a policy change.
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

interface PublicUser {
  id: number;
  email: string;
}

function toPublicUser(user: { id: number; email: string }): PublicUser {
  return { id: user.id, email: user.email };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

/**
 * A throwaway hash used when the submitted email does not exist. A failed login
 * then performs one real Argon2id verification whether or not the account
 * exists, which narrows the timing gap. It does not remove it: the database
 * lookup and session handling still differ, so treat this as best-effort.
 */
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("timing-equalisation-placeholder-value");
  return dummyHash;
}
void getDummyHash(); // warm up at startup so the first unknown-email login isn't slower

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid registration details",
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  const { email, password } = parsed.data;

  if (findUserByEmail(email)) {
    res.status(409).json({ error: "Email is already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = insertUser(email, passwordHash);
  } catch (error) {
    // Two requests can pass the check above at the same time; the UNIQUE
    // constraint is the real guarantee, so translate it into the same 409.
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Email is already registered" });
      return;
    }
    throw error;
  }

  // Never keep the pre-login session id after a privilege change.
  await regenerateSession(req);
  req.session.userId = user.id;
  await saveSession(req);

  res.status(201).json({ user: toPublicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid login payload" });
    return;
  }

  const { email, password } = parsed.data;
  const user = findUserByEmail(email);

  const hash = user?.passwordHash ?? (await getDummyHash());
  const passwordMatches = await verifyPassword(hash, password);

  if (!user || !passwordMatches) {
    // Identical response for "no such user" and "wrong password" so the API
    // does not confirm which emails exist.
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await regenerateSession(req);
  req.session.userId = user.id;
  await saveSession(req);

  res.json({ user: toPublicUser(user) });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const userId = currentUserId(req);

  const user = userId === undefined ? undefined : findUserById(userId);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  res.json({ user: toPublicUser(user) });
});

authRouter.post("/logout", async (req, res) => {
  await destroySession(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
  res.status(204).end();
});
