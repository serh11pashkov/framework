import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import {
  ensureTestSchema,
  resetTestData,
  seedReferenceCache,
} from "../helpers/integration.js";

let app;
let accessToken;

const registerAndLogin = async () => {
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "devices@example.com",
      password: "password123",
      passwordConfirm: "password123",
    },
  });

  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "devices@example.com",
      password: "password123",
    },
  });

  accessToken = login.json().accessToken;
};

describe("device routes", () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await ensureTestSchema(app);
    await seedReferenceCache([{ id: 1, type: "sensor", powerWatt: 15 }]);
    await resetTestData(app);
    await registerAndLogin();
  });

  beforeEach(async () => {
    await app.mysql.query("TRUNCATE TABLE items");
    await app.redis.flushdb();
    await seedReferenceCache([{ id: 1, type: "sensor", powerWatt: 15 }]);
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns empty lists and health payloads", async () => {
    const health = await app.inject({ method: "GET", url: "/api/v1/health" });
    const healthDetails = await app.inject({
      method: "GET",
      url: "/api/v1/health/details",
      headers: { "x-api-key": app.config.ADMIN_API_KEY },
    });
    const items = await app.inject({ method: "GET", url: "/api/v1/items" });
    const itemsV2 = await app.inject({ method: "GET", url: "/api/v2/items" });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    expect(healthDetails.statusCode).toBe(200);
    expect(items.json()).toMatchObject({ count: 0, items: [] });
    expect(itemsV2.json()).toMatchObject({ total: 0, items: [] });
  });

  it("creates, updates, exports and deletes devices through protected routes", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/items",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        device: "Living room sensor",
        room: "Living Room",
        status: "on",
        description: "Main sensor",
        power: "15W",
      },
    });

    expect(created.statusCode).toBe(201);
    const createdBody = created.json();
    expect(createdBody.device).toMatchObject({
      device: "Living room sensor",
      room: "Living Room",
      status: "on",
    });

    let itemId = createdBody.device?.id;

    if (!itemId) {
      const listAfterCreate = await app.inject({
        method: "GET",
        url: "/api/v1/items",
      });
      itemId = listAfterCreate.json().items?.[0]?.id;
    }

    expect(itemId).toBeTruthy();

    const byId = await app.inject({
      method: "GET",
      url: `/api/v1/items/${itemId}`,
    });

    expect(byId.statusCode).toBe(200);
    expect(byId.json()).toMatchObject({ id: itemId, room: "Living Room" });

    const details = await app.inject({
      method: "GET",
      url: `/api/v1/items/${itemId}/details`,
    });

    expect(details.statusCode).toBe(200);
    expect(details.json().reference).toMatchObject({
      type: "sensor",
      powerWatt: 15,
    });

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/v1/items/${itemId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: "off" },
    });

    expect(patch.statusCode).toBe(200);
    expect(patch.json().device.status).toBe("off");

    const replace = await app.inject({
      method: "PUT",
      url: `/api/v1/items/${itemId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        device: "Living room sensor",
        room: "Living Room",
        status: "on",
        description: "Updated",
        power: "20W",
      },
    });

    expect(replace.statusCode).toBe(200);
    expect(replace.json().device.power).toBe("20W");

    const exportResponse = await app.inject({
      method: "GET",
      url: "/api/v1/items/export?transform=true",
    });
    const streamResponse = await app.inject({
      method: "GET",
      url: "/api/v1/items/stream",
    });

    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.headers["content-type"]).toContain("text/csv");
    expect(exportResponse.payload).toContain("isActive");

    expect(streamResponse.statusCode).toBe(200);
    expect(streamResponse.headers["content-type"]).toContain(
      "application/x-ndjson",
    );
    expect(streamResponse.payload).toContain("Living room sensor");

    const boundary = "----vitest-boundary";
    const importBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="devices.json"',
      "Content-Type: application/json",
      "",
      JSON.stringify([
        {
          device: "Imported device",
          room: "Kitchen",
          status: "off",
          description: "",
          power: "",
        },
      ]),
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const importPayload = await app.inject({
      method: "POST",
      url: "/api/v1/items/import",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: importBody,
    });

    expect(importPayload.statusCode).toBe(200);
    expect(importPayload.json()).toHaveProperty("imported");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/items/${itemId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(deleted.statusCode).toBe(204);

    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/items/${itemId}`,
    });

    expect(missing.statusCode).toBe(404);
  });

  it("protects legacy aliases and admin routes", async () => {
    const protectedCreate = await app.inject({
      method: "POST",
      url: "/api/v1/devices",
      payload: { device: "Alias", room: "Hall" },
    });

    expect(protectedCreate.statusCode).toBe(401);

    const unauthorizedAdmin = await app.inject({
      method: "GET",
      url: "/api/v1/backups/123",
    });

    expect(unauthorizedAdmin.statusCode).toBe(401);
  });
});
