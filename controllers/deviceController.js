"use strict";

const db = require("#data");
const { readBody } = require("#utils/bodyParser");
const {
  validateCreate,
  validatePatch,
  validateReplace,
  validateQuery,
  validateParams,
  validate,
} = require("#validators");

function getHealth(req, res, send) {
  return send(res, 200, {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
}

function getDevices(req, res, send, parsedUrl) {
  const query = Object.fromEntries(parsedUrl.searchParams.entries());
  const errors = validate(validateQuery, query);
  if (errors) return send(res, 400, { error: errors.join("; ") });

  let results = db.getAll();
  if (query.room) {
    results = results.filter(
      (d) => d.room.toLowerCase() === query.room.toLowerCase(),
    );
  }
  return send(res, 200, { count: results.length, items: results });
}

function getDeviceById(req, res, send, id) {
  const errors = validate(validateParams, { id });
  if (errors) return send(res, 400, { error: errors.join("; ") });

  const device = db.getById(id);
  if (!device) return send(res, 404, { error: "Device not found" });
  return send(res, 200, device);
}

async function createDevice(req, res, send) {
  const data = await readBody(req);
  const errors = validate(validateCreate, data);
  if (errors) return send(res, 400, { error: errors.join("; ") });

  const newDevice = db.create({
    device: data.device.trim(),
    status: data.status || "off",
    room: data.room.trim(),
  });
  return send(res, 201, { message: "Device added", device: newDevice });
}

async function patchDevice(req, res, send, id) {
  const paramErrors = validate(validateParams, { id });
  if (paramErrors) return send(res, 400, { error: paramErrors.join("; ") });

  if (!db.getById(id)) return send(res, 404, { error: "Device not found" });

  const data = await readBody(req);

  if (data.id !== undefined)
    return send(res, 400, { error: "Field 'id' cannot be changed" });

  const errors = validate(validatePatch, data);
  if (errors) return send(res, 400, { error: errors.join("; ") });

  const updated = db.update(id, data);
  return send(res, 200, { message: "Device updated", device: updated });
}

async function replaceDevice(req, res, send, id) {
  const paramErrors = validate(validateParams, { id });
  if (paramErrors) return send(res, 400, { error: paramErrors.join("; ") });

  if (!db.getById(id)) return send(res, 404, { error: "Device not found" });

  const data = await readBody(req);

  if (data.id !== undefined)
    return send(res, 400, { error: "Field 'id' cannot be changed" });

  const errors = validate(validateReplace, data);
  if (errors) return send(res, 400, { error: errors.join("; ") });

  const replaced = db.replace(id, {
    device: data.device.trim(),
    status: data.status,
    room: data.room.trim(),
  });
  return send(res, 200, { message: "Device replaced", device: replaced });
}

function deleteDevice(req, res, send, id) {
  const errors = validate(validateParams, { id });
  if (errors) return send(res, 400, { error: errors.join("; ") });

  const deleted = db.remove(id);
  if (!deleted) return send(res, 404, { error: "Device not found" });
  return send(res, 200, { message: `Device with id=${id} deleted` });
}

module.exports = {
  getHealth,
  getDevices,
  getDeviceById,
  createDevice,
  patchDevice,
  replaceDevice,
  deleteDevice,
};
