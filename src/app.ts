import express, { type Express } from "express";
import helmet from "helmet";
import { isProduction } from "./config.js";
import { csrfSynchronisedProtection, generateToken } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { authRouter } from "./routes/auth.js";
import { createSessionMiddleware } from "./session.js";

export function createApp(): Express {
  const app = express();

  // Behind a TLS-terminating proxy, trust the first hop so express-session sees
  // X-Forwarded-Proto and will set `Secure` cookies correctly.
  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");

  app.use(helmet());
  app.use(express.json({ limit: "16kb" }));
  app.use(createSessionMiddleware());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Hand the client a CSRF token bound to its session. GET is a safe method, so
  // this route is exempt from CSRF checks.
  app.get("/api/csrf-token", (req, res) => {
    res.json({ csrfToken: generateToken(req) });
  });

  app.use(csrfSynchronisedProtection);
  app.use("/api/auth", authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
