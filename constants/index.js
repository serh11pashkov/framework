export const ALLOWED_STATUSES = ["on", "off"];
export const ALLOWED_NODE_ENVS = ["development", "production"];

export const MESSAGES = {
  NOT_FOUND: "Device not found",
  CREATED: "Device added",
  UPDATED: "Device updated",
  REPLACED: "Device replaced",
  ID_IMMUTABLE: "Field 'id' cannot be changed",
  DELETED: (id) => `Device with id=${id} deleted`,
};

// Redis cache keys
export const REDIS_KEYS = {
  ITEMS_LIST: (page = 1, limit = 10, room = "*") =>
    `cache:api:v2:items:page=${page}:limit=${limit}:room=${room}`,
  ITEMS_BY_ID: (id) => `cache:api:v2:items:${id}`,
  DEVICE_TYPES: "cache:reference:deviceTypes",
};
