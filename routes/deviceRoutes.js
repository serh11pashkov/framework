"use strict";

const ctrl = require("#controllers");

const ID_PATTERN = /^\/devices\/(\d+)$/;

async function router(req, res, send, parsedUrl) {
  const { method } = req;
  const { pathname } = parsedUrl;
  const idMatch = pathname.match(ID_PATTERN);
  const id = idMatch ? parseInt(idMatch[1]) : null;

  if (method === "GET" && pathname === "/health") {
    return ctrl.getHealth(req, res, send);
  }
  if (method === "GET" && pathname === "/devices") {
    return ctrl.getDevices(req, res, send, parsedUrl);
  }
  if (method === "GET" && idMatch) {
    return ctrl.getDeviceById(req, res, send, id);
  }
  if (method === "POST" && pathname === "/devices") {
    return ctrl.createDevice(req, res, send);
  }
  if (method === "PATCH" && idMatch) {
    return ctrl.patchDevice(req, res, send, id);
  }
  if (method === "PUT" && idMatch) {
    return ctrl.replaceDevice(req, res, send, id);
  }
  if (method === "DELETE" && idMatch) {
    return ctrl.deleteDevice(req, res, send, id);
  }

  return send(res, 404, { error: "Route not found" });
}

module.exports = { router };
