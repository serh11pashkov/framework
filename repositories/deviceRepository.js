import fs from "fs/promises";
import path from "path";
import { writeAtomic } from "#utils";
import { DeviceModel } from "#models";

const DATA_DIR = path.join(process.cwd(), "data", "items");

const initDir = async () => await fs.mkdir(DATA_DIR, { recursive: true });

export const getAll = async () => {
  await initDir();
  const files = await fs.readdir(DATA_DIR);
  const devices = [];
  for (const file of files.filter((f) => f.endsWith(".json"))) {
    const data = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    devices.push(JSON.parse(data));
  }
  return devices;
};

export const getById = async (id) => {
  try {
    const data = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
};

export const create = async (data) => {
  await initDir();
  const devices = await getAll();
  const id = devices.length > 0 ? Math.max(...devices.map((d) => d.id)) + 1 : 1;
  const device = { ...DeviceModel, ...data, id };
  await writeAtomic(path.join(DATA_DIR, `${id}.json`), device);
  return device;
};

export const update = async (id, updates) => {
  const existing = await getById(id);
  if (!existing) return null;
  const updatedDevice = { ...existing, ...updates };
  await writeAtomic(path.join(DATA_DIR, `${id}.json`), updatedDevice);
  return updatedDevice;
};

export const replace = async (id, data) => {
  const existing = await getById(id);
  if (!existing) return null;
  const replacedDevice = { ...DeviceModel, ...data, id };
  await writeAtomic(path.join(DATA_DIR, `${id}.json`), replacedDevice);
  return replacedDevice;
};

export const remove = async (id) => {
  try {
    await fs.unlink(path.join(DATA_DIR, `${id}.json`));
    return true;
  } catch {
    return false;
  }
};
