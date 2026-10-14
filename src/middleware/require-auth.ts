import type { NextFunction, Request, Response } from "express";

/** The id of the authenticated user, or `undefined` if not signed in. */
export function currentUserId(req: Request): number | undefined {
  const { userId } = req.session;
  return typeof userId === "number" ? userId : undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (currentUserId(req) === undefined) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}
