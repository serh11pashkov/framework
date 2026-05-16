import argon2 from "argon2";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createAuthService } from "../../services/authService.js";

const createDbMock = (selectResult = []) => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(selectResult),
  };

  return {
    select: vi.fn(() => chain),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue({ insertId: 11 }),
    })),
    chain,
  };
};

describe("createAuthService", () => {
  beforeEach(() => {
    vi.spyOn(argon2, "hash").mockResolvedValue("hashed-password");
    vi.spyOn(argon2, "verify").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers a new user and hashes the password", async () => {
    const db = createDbMock([]);
    const service = createAuthService({ db });

    const result = await service.register("test@example.com", "password123");

    expect(result).toEqual({ id: 11, email: "test@example.com" });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(argon2.hash).toHaveBeenCalledWith("password123");
  });

  it("rejects duplicate registration", async () => {
    const db = createDbMock([{ id: 1, email: "test@example.com" }]);
    const service = createAuthService({ db });

    await expect(
      service.register("test@example.com", "password123"),
    ).rejects.toThrow("Email already registered");
  });

  it("logs in an existing user with a valid password", async () => {
    const db = createDbMock([
      { id: 5, email: "test@example.com", password: "hashed-password" },
    ]);
    const service = createAuthService({ db });

    const result = await service.login("test@example.com", "password123");

    expect(result).toEqual({ id: 5, email: "test@example.com" });
    expect(argon2.verify).toHaveBeenCalledWith(
      "hashed-password",
      "password123",
    );
  });

  it("rejects invalid credentials", async () => {
    const db = createDbMock([]);
    const service = createAuthService({ db });

    await expect(
      service.login("test@example.com", "password123"),
    ).rejects.toThrow("Invalid credentials");
  });
});
