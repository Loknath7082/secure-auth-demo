import type { NextFunction, Request, Response } from "express";

interface HttpErrorLike {
  code?: string;
  type?: string;
  status?: number;
  statusCode?: number;
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

/**
 * Central error handler. It must keep all four parameters — Express detects
 * error-handling middleware by arity.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const httpError = err as HttpErrorLike;

  if (httpError?.code === "EBADCSRFTOKEN") {
    res.status(403).json({ error: "Invalid or missing CSRF token" });
    return;
  }

  // body-parser marks malformed JSON with type: "entity.parse.failed".
  if (httpError?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }

  // Other body-parser failures carry their own 4xx status (for example
  // "entity.too.large" -> 413 from the 16kb limit, and "encoding.unsupported"
  // -> 415). Honour it instead of reporting a server fault for a client error.
  const status = httpError?.status ?? httpError?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({
      error: httpError?.type === "entity.too.large" ? "Request body too large" : "Bad request",
    });
    return;
  }

  // Anything else is unexpected: log it server-side and return a generic
  // message so stack traces and SQL errors never reach the client.
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
}
