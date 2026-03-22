import { ALLOWED_STATUSES } from "#constants";

export const deviceProperties = {
  id: { type: "integer" },
  device: { type: "string" },
  status: { type: "string" },
  room: { type: "string" },
};

export const createBodySchema = {
  type: "object",
  required: ["device", "room"],
  properties: {
    device: { type: "string", minLength: 1 },
    room: { type: "string", minLength: 1 },
    status: { type: "string", enum: ALLOWED_STATUSES },
  },
  additionalProperties: false,
};

export const patchBodySchema = {
  type: "object",
  minProperties: 1,
  properties: {
    device: { type: "string", minLength: 1 },
    room: { type: "string", minLength: 1 },
    status: { type: "string", enum: ALLOWED_STATUSES },
  },
  additionalProperties: false,
};

export const replaceBodySchema = {
  type: "object",
  required: ["device", "room", "status"],
  properties: {
    device: { type: "string", minLength: 1 },
    room: { type: "string", minLength: 1 },
    status: { type: "string", enum: ALLOWED_STATUSES },
  },
  additionalProperties: false,
};

export const querySchema = {
  type: "object",
  properties: {
    room: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
};

export const paramsSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "integer", minimum: 1 },
  },
};

export const deviceResponseSchema = {
  type: "object",
  properties: deviceProperties,
};

export const devicesListResponseSchema = {
  type: "object",
  properties: {
    count: { type: "integer" },
    items: {
      type: "array",
      items: { type: "object", properties: deviceProperties },
    },
  },
};
