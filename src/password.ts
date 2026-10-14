import argon2 from "argon2";

/**
 * One of the minimum Argon2id configurations listed in the OWASP Password Storage Cheat Sheet: m=19456 (19 MiB), t=2, p=1.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    // The encoded hash carries its own algorithm and parameters, so no options
    // are needed here.
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
