import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import {
  ensureTestSchema,
  resetTestData,
  seedReferenceCache,
} from "../helpers/integration.js";

let app;

const createUser = async () =>
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "test@example.com",
      password: "password123",
      passwordConfirm: "password123",
    },
  });

describe("auth routes", () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await ensureTestSchema(app);
    await seedReferenceCache([{ id: 1, type: "sensor", powerWatt: 15 }]);
  });

  beforeEach(async () => {
    await resetTestData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers a user and rejects duplicates", async () => {
    const first = await createUser();

    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({
      id: expect.any(Number),
      email: "test@example.com",
    });

    const duplicate = await createUser();
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.json()).toEqual({ error: "Email already registered" });
  });

  it("logs in, refreshes token, reads current user and logs out", async () => {
    await createUser();

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "test@example.com",
        password: "password123",
      },
    });

    expect(login.statusCode).toBe(200);
    expect(login.json()).toHaveProperty("accessToken");

    const authHeader = `Bearer ${login.json().accessToken}`;
    const refreshCookie = login.cookies?.find(
      (cookie) => cookie.name === "refreshToken",
    );
    const cookieHeader = refreshCookie
      ? `refreshToken=${refreshCookie.value}`
      : undefined;

    expect(cookieHeader).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: authHeader },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      email: "test@example.com",
    });

    const refresh = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { cookie: cookieHeader },
    });

    expect(refresh.statusCode).toBe(200);
    expect(refresh.json()).toHaveProperty("accessToken");

    const logout = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { authorization: authHeader },
    });

    expect(logout.statusCode).toBe(204);

    const afterLogout = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: authHeader },
    });

    expect(afterLogout.statusCode).toBe(401);
  });

  it("rejects invalid credentials and missing refresh token", async () => {
    await createUser();

    const invalidLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "test@example.com",
        password: "wrong-password",
      },
    });

    expect(invalidLogin.statusCode).toBe(401);

    const refreshMissing = await app.inject({
      method: "POST",
      url: "/auth/refresh",
    });

    expect(refreshMissing.statusCode).toBe(401);
  });
});
