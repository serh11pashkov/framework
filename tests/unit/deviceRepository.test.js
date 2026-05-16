import { describe, expect, it, vi } from "vitest";
import {
  clear,
  count,
  create as createRow,
  createDeviceRepository,
  getAll,
  getById,
  iterateAll,
  remove,
  replace,
  setDeviceRepository,
  update,
} from "../../repositories/deviceRepository.js";

const buildDbMock = () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };

  const deleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };

  return {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        $returningId: vi.fn().mockResolvedValue([{ id: 3 }]),
      })),
    })),
    update: vi.fn(() => updateChain),
    delete: vi.fn(() => deleteChain),
    execute: vi.fn().mockResolvedValue(undefined),
    selectChain,
  };
};

describe("createDeviceRepository", () => {
  it("reads, normalizes and writes device rows", async () => {
    const db = buildDbMock();
    const repository = createDeviceRepository(db);

    db.selectChain.orderBy.mockResolvedValueOnce([
      {
        id: 1,
        device: "Lamp",
        status: "on",
        room: "Hall",
        description: null,
        image: null,
        power: null,
      },
    ]);
    db.selectChain.limit
      .mockResolvedValueOnce([
        {
          id: 2,
          device: "Sensor",
          status: "off",
          room: "Kitchen",
          description: "",
          image: "/2/image.jpg",
          power: "5W",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 3,
          device: "Lamp",
          status: "off",
          room: "Hall",
          description: "",
          image: null,
          power: "5W",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 3,
          device: "Lamp",
          status: "off",
          room: "Hall",
          description: "Updated",
          image: null,
          power: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 3,
          device: "Lamp",
          status: "off",
          room: "Hall",
          description: "Updated",
          image: null,
          power: null,
        },
      ]);

    await expect(repository.getAll()).resolves.toEqual([
      {
        id: 1,
        device: "Lamp",
        status: "on",
        room: "Hall",
        description: "",
        image: null,
        power: null,
      },
    ]);

    await expect(repository.getById(2)).resolves.toEqual({
      id: 2,
      device: "Sensor",
      status: "off",
      room: "Kitchen",
      description: "",
      image: "/2/image.jpg",
      power: "5W",
    });

    await expect(
      repository.create({
        device: "Lamp",
        status: "on",
        room: "Hall",
        description: "",
        image: null,
        power: "5W",
      }),
    ).resolves.toEqual({
      id: 3,
      device: "Lamp",
      status: "on",
      room: "Hall",
      description: "",
      image: null,
      power: "5W",
    });

    await expect(
      repository.update(3, { status: "off", ignored: true }),
    ).resolves.toEqual({
      id: 3,
      device: "Lamp",
      status: "off",
      room: "Hall",
      description: "",
      image: null,
      power: "5W",
    });

    await expect(
      repository.replace(3, {
        device: "Lamp",
        status: "off",
        room: "Hall",
        description: "Updated",
        image: null,
        power: null,
      }),
    ).resolves.toEqual({
      id: 3,
      device: "Lamp",
      status: "off",
      room: "Hall",
      description: "Updated",
      image: null,
      power: null,
    });

    await expect(repository.remove(3)).resolves.toBe(true);
    await expect(repository.clear()).resolves.toBeUndefined();

    expect(db.update).toHaveBeenCalledTimes(2);
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it("returns false when removing a missing row", async () => {
    const db = buildDbMock();
    const repository = createDeviceRepository(db);

    db.selectChain.limit.mockResolvedValueOnce([]);

    await expect(repository.remove(99)).resolves.toBe(false);
  });

  it("counts rows with an aggregate query", async () => {
    const db = buildDbMock();
    const repository = createDeviceRepository(db);

    db.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([{ total: 2 }]),
    });

    await expect(repository.count()).resolves.toBe(2);
  });

  it("exposes repository wrappers once wired", async () => {
    const db = buildDbMock();
    const repository = createDeviceRepository(db);
    setDeviceRepository(repository);

    db.selectChain.orderBy.mockResolvedValue([
      { id: 1, device: "Lamp", status: "on", room: "Hall" },
    ]);
    db.selectChain.limit.mockResolvedValue([
      { id: 1, device: "Lamp", status: "on", room: "Hall" },
    ]);

    await expect(getAll()).resolves.toEqual([
      {
        id: 1,
        device: "Lamp",
        status: "on",
        room: "Hall",
        description: "",
        image: null,
        power: null,
      },
    ]);
    await expect(getById(1)).resolves.toMatchObject({ id: 1, device: "Lamp" });
    await expect(
      createRow({ device: "Lamp", status: "on", room: "Hall" }),
    ).resolves.toMatchObject({ id: 3 });
    await expect(update(1, { status: "off" })).resolves.toMatchObject({
      id: 1,
    });
    await expect(
      replace(1, { device: "Lamp", status: "off", room: "Hall" }),
    ).resolves.toMatchObject({ id: 1 });
    await expect(remove(1)).resolves.toBe(true);
    await expect(clear()).resolves.toBeUndefined();
    db.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([{ total: 1 }]),
    });

    await expect(count()).resolves.toBe(1);

    const items = [];
    for await (const row of iterateAll()) {
      items.push(row);
      break;
    }

    expect(items).toHaveLength(1);
  });
});
