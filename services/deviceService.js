import * as repo from "#repositories";
import { REDIS_KEYS } from "#constants";
import { Readable } from "stream";

const EXTERNAL_BASE_URL =
  // eslint-disable-next-line no-restricted-syntax
  process.env.EXTERNAL_BASE_URL ?? "http://localhost:3001/deviceTypes";
const REFERENCE_TTL_SECONDS = 120;

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

// Factory function with Redis dependency injection
export const createDeviceService = ({ redis } = {}) => {
  const getExternalDeviceTypes = async () => {
    if (!redis) {
      // Fallback if Redis is not available (for testing)
      return await fetchWithRetry(EXTERNAL_BASE_URL);
    }

    const cacheKey = REDIS_KEYS.DEVICE_TYPES;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const fetched = await fetchWithRetry(EXTERNAL_BASE_URL);
    await redis.set(
      cacheKey,
      JSON.stringify(fetched),
      "EX",
      REFERENCE_TTL_SECONDS,
    );
    return fetched;
  };

  const resolveDeviceType = (deviceName = "") => {
    const value = String(deviceName).trim().toLowerCase();
    if (!value) return null;

    const tokens = value.split(/\s+/);
    return tokens[tokens.length - 1] ?? null;
  };

  return {
    async getDevices({ room } = {}) {
      const all = await repo.getAll();
      const items = room
        ? all.filter((d) => d.room.toLowerCase() === room.toLowerCase())
        : all;
      return { count: items.length, items };
    },

    getDevicesObjectStream({ room } = {}) {
      const iterator = async function* () {
        for await (const item of repo.iterateAll()) {
          if (
            room &&
            String(item.room).toLowerCase() !== String(room).toLowerCase()
          ) {
            continue;
          }

          yield item;
        }
      };

      return Readable.from(iterator(), { objectMode: true });
    },

    async getDevicesPaginated({ page = 1, limit = 10, room } = {}) {
      const normalizedPage =
        Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
      const normalizedLimit =
        Number.isFinite(limit) && limit > 0
          ? Math.min(Math.floor(limit), 100)
          : 10;

      const cacheKey = REDIS_KEYS.ITEMS_LIST(
        normalizedPage,
        normalizedLimit,
        room || "*",
      );

      // Check cache first
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      const all = await repo.getAll();
      const filtered = room
        ? all.filter((d) => d.room.toLowerCase() === room.toLowerCase())
        : all;

      const total = filtered.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedLimit);
      const start = (normalizedPage - 1) * normalizedLimit;
      const items = filtered.slice(start, start + normalizedLimit);

      const result = {
        items,
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        totalPages,
      };

      // Cache for 24 hours
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(result), "EX", 86400);
      }

      return result;
    },

    async getDeviceById(id) {
      return await repo.getById(id);
    },

    async createDevice(data) {
      return await repo.create({
        device: data.device.trim(),
        status: data.status ?? "off",
        room: data.room.trim(),
        description: data.description?.trim() ?? "",
        power: data.power?.trim() || null,
      });
    },

    async patchDevice(id, data) {
      return await repo.update(id, data);
    },

    async replaceDevice(id, data) {
      return await repo.replace(id, {
        device: data.device.trim(),
        status: data.status,
        room: data.room.trim(),
        description: data.description?.trim() ?? "",
        power: data.power?.trim() || null,
      });
    },

    async deleteDevice(id) {
      return await repo.remove(id);
    },

    async getItemWithDetails(id) {
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
    },

    async invalidateItemsCache() {
      if (!redis) return;
      // Delete all items list cache keys (pagination)
      const pattern = REDIS_KEYS.ITEMS_LIST("*", "*", "*");
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    },
  };
};
