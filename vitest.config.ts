import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      PORT: "3000",
      // 32+ characters so it passes config validation.
      SESSION_SECRET: "test-only-secret-value-please-change-me-0001",
      // In-memory SQLite: each test file gets its own throwaway database.
      DATABASE_PATH: ":memory:",
    },
  },
});
