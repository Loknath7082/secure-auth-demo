import { z } from "zod";

/**
 * The whole app reads configuration from here, and the process refuses to
 * start with an invalid configuration instead of failing later at runtime.
 */

/**
 * A blank env var (for example `PORT=` in a .env file) should fall back to the
 * default rather than being coerced into 0 or NaN.
 */
function optionalNumber(fallback: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().positive().default(fallback),
  );
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: optionalNumber(3000),

  // The secret used to sign the session cookie. 32+ bytes of randomness.
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters of randomness"),

  DATABASE_PATH: z.string().min(1).default("./data/app.db"),

  // How long a session stays valid, in milliseconds. Default: 8 hours.
  SESSION_TTL_MS: optionalNumber(1000 * 60 * 60 * 8),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const config = parsed.data;

export const isProduction = config.NODE_ENV === "production";
export const isTest = config.NODE_ENV === "test";
