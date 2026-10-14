import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { db } from "../src/db.js";

const app = createApp();
const VALID_PASSWORD = "correct horse battery staple";

type Agent = ReturnType<typeof request.agent>;

function setCookieHeaders(res: request.Response): string[] {
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function sessionCookie(res: request.Response): string {
  const cookie = setCookieHeaders(res).find((value) => value.startsWith("sid="));
  if (!cookie) throw new Error("Response did not set a session cookie");
  return cookie;
}

async function getCsrfToken(agent: Agent): Promise<string> {
  const res = await agent.get("/api/csrf-token");
  expect(res.status).toBe(200);
  return res.body.csrfToken as string;
}

async function register(agent: Agent, email: string, password = VALID_PASSWORD) {
  const token = await getCsrfToken(agent);
  return agent.post("/api/auth/register").set("x-csrf-token", token).send({ email, password });
}

describe("auth api", () => {
  it("sets an HttpOnly, SameSite=Lax session cookie", async () => {
    const agent = request.agent(app);
    const res = await register(agent, "cookie@example.com");
    const cookie = sessionCookie(res);

    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/;\s*Secure/i); // dev/test, so it also works over HTTP
  });

  it("rejects a duplicate email with 409", async () => {
    const first = request.agent(app);
    expect((await register(first, "dup@example.com")).status).toBe(201);

    const second = request.agent(app);
    const res = await register(second, "dup@example.com");
    expect(res.status).toBe(409);
  });

  it("rotates the session id on login to prevent session fixation", async () => {
    const agent = request.agent(app);
    const registered = await register(agent, "rotate@example.com");
    const before = sessionCookie(registered);

    const token = await getCsrfToken(agent);
    const loggedIn = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", token)
      .send({ email: "rotate@example.com", password: VALID_PASSWORD });

    expect(loggedIn.status).toBe(200);
    expect(sessionCookie(loggedIn)).not.toBe(before);
  });

  it("rejects an unknown email with the same message as a wrong password", async () => {
    const agent = request.agent(app);
    const token = await getCsrfToken(agent);
    const res = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", token)
      .send({ email: "nobody@example.com", password: VALID_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("blocks a state-changing request that has no token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "no-csrf@example.com", password: VALID_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/CSRF/i);
  });

  it("invalidates the session on logout", async () => {
    const agent = request.agent(app);
    await register(agent, "logout@example.com");
    expect((await agent.get("/api/auth/me")).status).toBe(200);

    const token = await getCsrfToken(agent);
    expect((await agent.post("/api/auth/logout").set("x-csrf-token", token)).status).toBe(204);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });
});
