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
