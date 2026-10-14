import { db } from "./db.js";

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: number;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: number;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export function findUserByEmail(email: string): User | undefined {
  const row = db
    .prepare("SELECT id, email, password_hash, created_at FROM users WHERE email = ?")
    .get(email) as UserRow | undefined;
  return row ? toUser(row) : undefined;
}

export function findUserById(id: number): User | undefined {
  const row = db
    .prepare("SELECT id, email, password_hash, created_at FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;
  return row ? toUser(row) : undefined;
}

export function insertUser(email: string, passwordHash: string): User {
  const row = db
    .prepare(
      `INSERT INTO users (email, password_hash, created_at)
       VALUES (?, ?, ?)
       RETURNING id, email, password_hash, created_at`,
    )
    .get(email, passwordHash, Date.now()) as UserRow;
  return toUser(row);
}
