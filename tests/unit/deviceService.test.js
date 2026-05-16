import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as repo from "../../repositories/deviceRepository.js";
import {
  createDevice,
  deleteDevice,
  getDeviceById,
  getDevices,
  getDevicesPaginated,
  getItemWithDetails,
  getDevicesObjectStream,
  replaceDevice,
} from "../../services/deviceService.js";
import fs from "fs/promises";
import path from "path";

vi.mock("../../repositories/deviceRepository.js", () => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  replace: vi.fn(),
  remove: vi.fn(),
  iterateAll: vi.fn(),
}));

describe("deviceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters devices by room", async () => {
    repo.getAll.mockResolvedValue([
      { id: 1, room: "Kitchen" },
      { id: 2, room: "Living Room" },
    ]);

    const result = await getDevices({ room: "kitchen" });

    expect(result).toEqual({ count: 1, items: [{ id: 1, room: "Kitchen" }] });
  });

  it("paginates devices and normalizes bounds", async () => {
    repo.getAll.mockResolvedValue([
      { id: 1, room: "A" },
      { id: 2, room: "B" },
      { id: 3, room: "C" },
    ]);

    const result = await getDevicesPaginated({ page: 0, limit: 500 });

    expect(result).toMatchObject({
      page: 1,
      limit: 100,
      total: 3,
      totalPages: 1,
      items: [
        { id: 1, room: "A" },
        { id: 2, room: "B" },
        { id: 3, room: "C" },
      ],
    });
  });

  it("trims payload before create and replace", async () => {
    repo.create.mockResolvedValue({ id: 1, device: "Lamp", room: "Hall" });
    repo.replace.mockResolvedValue({ id: 1, device: "Lamp", room: "Hall" });

    await createDevice({
      device: " Lamp ",
      room: " Hall ",
      description: " Test ",
      power: " 10W ",
    });

    await replaceDevice(1, {
      device: " Lamp ",
      room: " Hall ",
      status: "on",
      description: " Test ",
      power: " 10W ",
    });

    expect(repo.create).toHaveBeenCalledWith({
      device: "Lamp",
      status: "off",
      room: "Hall",
      description: "Test",
      power: "10W",
    });
    expect(repo.replace).toHaveBeenCalledWith(1, {
      device: "Lamp",
      status: "on",
      room: "Hall",
      description: "Test",
      power: "10W",
    });
  });

  it("passes through getById and delete operations", async () => {
    repo.getById.mockResolvedValue({ id: 7, device: "Sensor" });
    repo.remove.mockResolvedValue(true);

    await expect(getDeviceById(7)).resolves.toEqual({
      id: 7,
      device: "Sensor",
    });
    await expect(deleteDevice(7)).resolves.toBe(true);
  });

  it("streams devices and resolves item details from cached references", async () => {
    repo.iterateAll.mockReturnValue(
      (async function* () {
        yield { id: 1, room: "Kitchen", image: "/1/image.jpg" };
        yield { id: 2, room: "Hall", image: null };
      })(),
    );
    repo.getById.mockResolvedValue({
      id: 1,
      device: "Kitchen sensor",
      room: "Kitchen",
      image: "/1/image.jpg",
    });

    const cacheDir = path.join(process.cwd(), "data", "cache");
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(cacheDir, "reference.json"),
      JSON.stringify({
        cachedAt: Date.now(),
        data: [{ id: 9, type: "sensor", powerWatt: 12 }],
      }),
      "utf8",
    );

    const streamed = [];
    for await (const item of getDevicesObjectStream({ room: "kitchen" })) {
      streamed.push(item);
    }

    const details = await getItemWithDetails(1);

    expect(streamed).toEqual([
      { id: 1, room: "Kitchen", image: "/1/image.jpg" },
    ]);
    expect(details).toMatchObject({
      id: 1,
      reference: {
        id: 9,
        type: "sensor",
        powerWatt: 12,
      },
    });
  });

  it("returns null when the item does not exist", async () => {
    repo.getById.mockResolvedValueOnce(null);

    await expect(getItemWithDetails(404)).resolves.toBeNull();
  });

  it("falls back to a null reference when external lookup fails", async () => {
    repo.getById.mockResolvedValueOnce({
      id: 10,
      device: "Unknown light",
      room: "Office",
      image: null,
    });

    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(global, "setTimeout").mockImplementation((callback) => {
      callback();
      return 0;
    });
    vi.spyOn(global, "clearTimeout").mockImplementation(() => {});

    const cacheDir = path.join(process.cwd(), "data", "cache");
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(cacheDir, "reference.json"),
      JSON.stringify({
        cachedAt: Date.now() - 999999,
        data: [],
      }),
      "utf8",
    );

    await expect(getItemWithDetails(10)).resolves.toMatchObject({
      id: 10,
      reference: {
        id: null,
        type: null,
        powerWatt: null,
      },
    });
  });

  it("returns a null reference when no catalog match exists", async () => {
    repo.getById.mockResolvedValueOnce({
      id: 11,
      device: "Kitchen toaster",
      room: "Kitchen",
      image: null,
    });

    const cacheDir = path.join(process.cwd(), "data", "cache");
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(cacheDir, "reference.json"),
      JSON.stringify({
        cachedAt: Date.now(),
        data: [{ id: 1, type: "sensor", powerWatt: 7 }],
      }),
      "utf8",
    );

    await expect(getItemWithDetails(11)).resolves.toMatchObject({
      id: 11,
      reference: {
        id: null,
        type: null,
        powerWatt: null,
      },
    });
  });
});
