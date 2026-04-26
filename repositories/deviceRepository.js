import fs from "fs/promises";
import path from "path";
import { writeAtomic } from "#utils";
import { DeviceModel } from "#models";

const DATA_DIR = path.join(process.cwd(), "data", "items");

const initDir = async () => await fs.mkdir(DATA_DIR, { recursive: true });
const normalizeDevice = (device) => ({ ...DeviceModel, ...device });

export const getAll = async () => {
  await initDir();
  const files = await fs.readdir(DATA_DIR);
  const devices = [];
  for (const file of files.filter((f) => f.endsWith(".json"))) {
    const data = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    devices.push(normalizeDevice(JSON.parse(data)));
  }
  return devices.sort((a, b) => Number(a.id) - Number(b.id));
};

export const iterateAll = async function* () {
  await initDir();
  const files = await fs.readdir(DATA_DIR);
  const sorted = files
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

  for (const file of sorted) {
    const content = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    yield normalizeDevice(JSON.parse(content));
  }
};

export const getById = async (id) => {
  try {
    const data = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf8");
    return normalizeDevice(JSON.parse(data));
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
  const updatedDevice = normalizeDevice({ ...existing, ...updates });
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
