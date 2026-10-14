import "express-session";

declare module "express-session" {
  interface SessionData {
    /** The authenticated user's id. Absent for anonymous visitors. */
    userId?: number;
  }
}
