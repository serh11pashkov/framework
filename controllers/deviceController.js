import * as service from "#services";
import { MESSAGES } from "#constants";

export async function getHealth(request, reply) {
  return reply.send({ status: "ok" });
}

export async function getHealthDetails(request, reply) {
  return reply.send({
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
}

export async function getDevices(request, reply) {
  return reply.send(service.getDevices({ room: request.query.room }));
}

export async function getDeviceById(request, reply) {
  const device = service.getDeviceById(request.params.id);
  if (!device) throw reply.notFound(MESSAGES.NOT_FOUND);
  return reply.send(device);
}

export async function createDevice(request, reply) {
  const device = service.createDevice(request.body);
  return reply.status(201).send({ message: MESSAGES.CREATED, device });
}

export async function patchDevice(request, reply) {
  if (!service.getDeviceById(request.params.id))
    throw reply.notFound(MESSAGES.NOT_FOUND);
  if (request.body.id !== undefined)
    throw reply.badRequest(MESSAGES.ID_IMMUTABLE);
  const device = service.patchDevice(request.params.id, request.body);
  return reply.send({ message: MESSAGES.UPDATED, device });
}

export async function replaceDevice(request, reply) {
  if (!service.getDeviceById(request.params.id))
    throw reply.notFound(MESSAGES.NOT_FOUND);
  if (request.body.id !== undefined)
    throw reply.badRequest(MESSAGES.ID_IMMUTABLE);
  const device = service.replaceDevice(request.params.id, request.body);
  return reply.send({ message: MESSAGES.REPLACED, device });
}

export async function deleteDevice(request, reply) {
  const deleted = service.deleteDevice(request.params.id);
  if (!deleted) throw reply.notFound(MESSAGES.NOT_FOUND);
  return reply.send({ message: MESSAGES.DELETED(request.params.id) });
}
