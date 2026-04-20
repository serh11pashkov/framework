import * as repo from "#repositories";
import fs from "fs/promises";
import path from "path";

const EXTERNAL_BASE_URL =
  // eslint-disable-next-line no-restricted-syntax
  process.env.EXTERNAL_BASE_URL ?? "http://localhost:3001/deviceTypes";
const REFERENCE_CACHE_FILE = path.join(
  process.cwd(),
  "data",
  "cache",
  "reference.json",
);
const REFERENCE_TTL_MS = 120_000;

const sleep = async (ms) =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const fetchWithRetry = async (url, options = {}) => {
  const delays = [1000, 2000, 4000];
  let lastError;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(
          `External service responded with ${response.status}`,
        );
        error.statusCode = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < delays.length - 1) {
        await sleep(delays[attempt]);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
};

const readFreshReferenceCache = async () => {
  try {
    const raw = await fs.readFile(REFERENCE_CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (
      !parsed?.cachedAt ||
      Date.now() - Number(parsed.cachedAt) > REFERENCE_TTL_MS
    ) {
      return null;
    }

    return Array.isArray(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
};

const writeReferenceCache = async (data) => {
  const dir = path.dirname(REFERENCE_CACHE_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    REFERENCE_CACHE_FILE,
    JSON.stringify({ cachedAt: Date.now(), data }, null, 2),
    "utf8",
  );
};

const getExternalDeviceTypes = async () => {
  const cached = await readFreshReferenceCache();
  if (cached) return cached;

  const fetched = await fetchWithRetry(EXTERNAL_BASE_URL);
  await writeReferenceCache(fetched);
  return fetched;
};

const resolveDeviceType = (deviceName = "") => {
  const value = String(deviceName).trim().toLowerCase();
  if (!value) return null;

  const tokens = value.split(/\s+/);
  return tokens[tokens.length - 1] ?? null;
};

export const getDevices = async ({ room } = {}) => {
  const all = await repo.getAll();
  const items = room
    ? all.filter((d) => d.room.toLowerCase() === room.toLowerCase())
    : all;
  return { count: items.length, items };
};

export const getDevicesPaginated = async ({
  page = 1,
  limit = 10,
  room,
} = {}) => {
  const normalizedPage =
    Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 10;

  const all = await repo.getAll();
  const filtered = room
    ? all.filter((d) => d.room.toLowerCase() === room.toLowerCase())
    : all;

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedLimit);
  const start = (normalizedPage - 1) * normalizedLimit;
  const items = filtered.slice(start, start + normalizedLimit);

  return {
    items,
    total,
    page: normalizedPage,
    limit: normalizedLimit,
    totalPages,
  };
};

export const getDeviceById = async (id) => await repo.getById(id);

export const createDevice = async (data) =>
  await repo.create({
    device: data.device.trim(),
    status: data.status ?? "off",
    room: data.room.trim(),
    description: data.description?.trim() ?? "",
  });

export const patchDevice = async (id, data) => await repo.update(id, data);

export const replaceDevice = async (id, data) =>
  await repo.replace(id, {
    device: data.device.trim(),
    status: data.status,
    room: data.room.trim(),
    description: data.description?.trim() ?? "",
  });

export const deleteDevice = async (id) => await repo.remove(id);

export const getItemWithDetails = async (id) => {
  const item = await repo.getById(id);
  if (!item) return null;

  try {
    const references = await getExternalDeviceTypes();
    const itemType = resolveDeviceType(item.device);
    const found = references.find(
      (entry) =>
        String(entry.type).toLowerCase() === String(itemType).toLowerCase(),
    );

    return {
      ...item,
      reference: found
        ? {
            id: found.id,
            type: found.type,
            powerWatt: found.powerWatt,
          }
        : {
            id: null,
            type: null,
            powerWatt: null,
          },
    };
  } catch {
    return {
      ...item,
      reference: {
        id: null,
        type: null,
        powerWatt: null,
      },
    };
  }
};
