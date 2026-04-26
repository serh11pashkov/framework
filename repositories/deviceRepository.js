import { asc, eq, sql } from "drizzle-orm";
import { items } from "../db/schema.js";

let repository = null;

const ensureRepository = () => {
  if (!repository) {
    throw new Error("Device repository is not initialized");
  }

  return repository;
};

const normalizeDevice = (device) => {
  if (!device) return null;

  return {
    id: Number(device.id),
    device: device.device,
    status: device.status,
    room: device.room,
    description: device.description ?? "",
    image: device.image ?? null,
    power: device.power ?? null,
  };
};

export const setDeviceRepository = (repo) => {
  repository = repo;
};

export const createDeviceRepository = (db) => ({
  async getAll() {
    const rows = await db.select().from(items).orderBy(asc(items.id));
    return rows.map(normalizeDevice);
  },

  async *iterateAll() {
    const rows = await db.select().from(items).orderBy(asc(items.id));

    for (const row of rows) {
      yield normalizeDevice(row);
    }
  },

  async getById(id) {
    const rows = await db
      .select()
      .from(items)
      .where(eq(items.id, Number(id)))
      .limit(1);

    return normalizeDevice(rows[0] ?? null);
  },

  async create(data) {
    const payload = {
      device: data.device,
      status: data.status ?? "off",
      room: data.room,
      description: data.description ?? "",
      image: data.image ?? null,
      power: data.power ?? null,
    };

    const [result] = await db.insert(items).values(payload).$returningId();
    return normalizeDevice({ id: result.id, ...payload });
  },

  async update(id, updates) {
    const allowedFields = [
      "device",
      "status",
      "room",
      "description",
      "image",
      "power",
    ];
    const payload = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        payload[key] = value;
      }
    }

    if (Object.keys(payload).length === 0) {
      return this.getById(id);
    }

    await db
      .update(items)
      .set(payload)
      .where(eq(items.id, Number(id)));
    return this.getById(id);
  },

  async replace(id, data) {
    const payload = {
      device: data.device,
      status: data.status,
      room: data.room,
      description: data.description ?? "",
      image: data.image ?? null,
      power: data.power ?? null,
    };

    await db
      .update(items)
      .set(payload)
      .where(eq(items.id, Number(id)));

    return this.getById(id);
  },

  async remove(id) {
    const existing = await this.getById(id);
    if (!existing) return false;

    await db.delete(items).where(eq(items.id, Number(id)));
    return true;
  },

  async clear() {
    await db.execute(sql`TRUNCATE TABLE items`);
  },

  async count() {
    const rows = await db.select({ total: sql`COUNT(*)` }).from(items);
    return Number(rows[0]?.total ?? 0);
  },
});

export const getAll = async () => await ensureRepository().getAll();
export const iterateAll = async function* () {
  yield* ensureRepository().iterateAll();
};
export const getById = async (id) => await ensureRepository().getById(id);
export const create = async (data) => await ensureRepository().create(data);
export const update = async (id, updates) =>
  await ensureRepository().update(id, updates);
export const replace = async (id, data) =>
  await ensureRepository().replace(id, data);
export const remove = async (id) => await ensureRepository().remove(id);
export const clear = async () => await ensureRepository().clear();
export const count = async () => await ensureRepository().count();
