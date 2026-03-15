import Ajv from "ajv";
import { ALLOWED_STATUSES } from "#constants";

const ajv = new Ajv({ allErrors: true });

const createSchema = {
  type: "object",
  required: ["device", "room"],
  properties: {
    device: { type: "string", minLength: 1 },
    room: { type: "string", minLength: 1 },
    status: { type: "string", enum: ALLOWED_STATUSES },
  },
  additionalProperties: false,
};

const patchSchema = {
  type: "object",
  minProperties: 1,
  properties: {
    device: { type: "string", minLength: 1 },
    room: { type: "string", minLength: 1 },
    status: { type: "string", enum: ALLOWED_STATUSES },
  },
  additionalProperties: false,
};

const replaceSchema = {
  type: "object",
  required: ["device", "room", "status"],
  properties: {
    device: { type: "string", minLength: 1 },
    room: { type: "string", minLength: 1 },
    status: { type: "string", enum: ALLOWED_STATUSES },
  },
  additionalProperties: false,
};

const querySchema = {
  type: "object",
  properties: {
    room: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
};

const paramsSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "integer", minimum: 1 },
  },
};

const validateCreate = ajv.compile(createSchema);
const validatePatch = ajv.compile(patchSchema);
const validateReplace = ajv.compile(replaceSchema);
const validateQuery = ajv.compile(querySchema);
const validateParams = ajv.compile(paramsSchema);

export function validate(validateFn, data) {
  const valid = validateFn(data);
  if (!valid) {
    return validateFn.errors.map((e) =>
      `${e.instancePath} ${e.message}`.trim(),
    );
  }
  return null;
}

export {
  validateCreate,
  validatePatch,
  validateReplace,
  validateQuery,
  validateParams,
};
