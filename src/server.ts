import { createApp } from "./app.js";
import { config } from "./config.js";
import { sessionStore } from "./session.js";

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`Auth API listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

const PRUNE_INTERVAL_MS = 30 * 60 * 1000;
const pruneTimer = setInterval(() => {
  const removed = sessionStore.pruneExpired();
  if (removed > 0) {
    console.log(`Pruned ${removed} expired session(s)`);
  }
}, PRUNE_INTERVAL_MS);
pruneTimer.unref();

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);
  clearInterval(pruneTimer);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
