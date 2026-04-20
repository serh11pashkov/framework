import * as service from "#services";
import { MESSAGES } from "#constants";
import { getFullImageUrl } from "#utils";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import Ajv from "ajv";
import { createBodySchema } from "#schemas/device";
import {
  getSharedReposV1Analytics,
  getSharedReposV2Analytics,
} from "../services/githubAnalyticsService.js";

const ajv = new Ajv();
const validateItem = ajv.compile(createBodySchema);

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
  const result = await service.getDevices({ room: request.query.room });

  result.items = result.items.map((d) => ({
    ...d,
    image: getFullImageUrl(request, d.image),
  }));
  return reply.send(result);
}

export async function getDeviceById(request, reply) {
  const device = await service.getDeviceById(request.params.id);
  if (!device) throw reply.notFound(MESSAGES.NOT_FOUND);

  device.image = getFullImageUrl(request, device.image);
  return reply.send(device);
}

export async function createDevice(request, reply) {
  const device = await service.createDevice(request.body);
  device.image = getFullImageUrl(request, device.image);
  return reply.status(201).send({ message: MESSAGES.CREATED, device });
}

export async function patchDevice(request, reply) {
  if (!(await service.getDeviceById(request.params.id)))
    throw reply.notFound(MESSAGES.NOT_FOUND);
  if (request.body.id !== undefined)
    throw reply.badRequest(MESSAGES.ID_IMMUTABLE);

  const device = await service.patchDevice(request.params.id, request.body);
  device.image = getFullImageUrl(request, device.image);
  return reply.send({ message: MESSAGES.UPDATED, device });
}

export async function replaceDevice(request, reply) {
  if (!(await service.getDeviceById(request.params.id)))
    throw reply.notFound(MESSAGES.NOT_FOUND);
  if (request.body.id !== undefined)
    throw reply.badRequest(MESSAGES.ID_IMMUTABLE);

  const device = await service.replaceDevice(request.params.id, request.body);
  device.image = getFullImageUrl(request, device.image);
  return reply.send({ message: MESSAGES.REPLACED, device });
}

export async function deleteDevice(request, reply) {
  const deleted = await service.deleteDevice(request.params.id);
  if (!deleted) throw reply.notFound(MESSAGES.NOT_FOUND);
  return reply.status(204).send();
}

// НОВІ ЕНДПОЇНТИ

export async function exportDevices(request, reply) {
  const devices = await service.getDevices();
  const exportData = devices.items.map((d) => ({
    ...d,
    image: getFullImageUrl(request, d.image) || "null",
  }));

  const csv = stringify(exportData, { header: true });
  reply.header("Content-Disposition", 'attachment; filename="devices.csv"');
  reply.type("text/csv");
  return reply.send(csv);
}

export async function importDevices(request, reply) {
  const data = await request.file();
  if (!data) throw reply.badRequest("No file uploaded");

  const buffer = await data.toBuffer();
  let items = [];

  try {
    if (
      data.mimetype === "application/json" ||
      data.filename.endsWith(".json")
    ) {
      items = JSON.parse(buffer.toString());
    } else if (data.mimetype === "text/csv" || data.filename.endsWith(".csv")) {
      items = parse(buffer, { columns: true, skip_empty_lines: true });
    } else {
      throw new Error("Unsupported file format. Use CSV or JSON.");
    }
  } catch (err) {
    throw reply.badRequest("Failed to parse file: " + err.message);
  }

  if (!Array.isArray(items)) items = [items];

  const report = { imported: 0, rejected: [] };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    delete item.id;
    delete item.image;

    if (validateItem(item)) {
      await service.createDevice(item);
      report.imported++;
    } else {
      report.rejected.push({
        line: i + 1,
        reason: ajv.errorsText(validateItem.errors),
      });
    }
  }

  return reply.send(report);
}

export async function uploadImage(request, reply) {
  const data = await request.file();
  if (!data) throw reply.badRequest("No image uploaded");

  if (!["image/jpeg", "image/png"].includes(data.mimetype)) {
    throw reply.badRequest("Only images (jpeg, png) allowed");
  }

  const id = request.params.id;
  const device = await service.getDeviceById(id);
  if (!device) throw reply.notFound(MESSAGES.NOT_FOUND);

  const ext = data.filename.endsWith(".png") ? ".png" : ".jpg";
  const relativePath = `/${id}/image${ext}`;
  const uploadDir = path.join(process.cwd(), "uploads", String(id));
  const fullPath = path.join(uploadDir, `image${ext}`);

  await fs.mkdir(uploadDir, { recursive: true });

  const stream = fsSync.createWriteStream(fullPath);
  await new Promise((resolve, reject) => {
    data.file.pipe(stream);
    data.file.on("end", resolve);
    data.file.on("error", reject);
  });

  const updatedDevice = await service.patchDevice(Number(id), {
    image: relativePath,
  });
  updatedDevice.image = getFullImageUrl(request, updatedDevice.image);

  return reply.send({
    message: "Image uploaded successfully",
    device: updatedDevice,
  });
}

export async function getItemsV2(request, reply) {
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 10);
  const room = request.query.room;

  const result = await service.getDevicesPaginated({ page, limit, room });
  result.items = result.items.map((d) => ({
    ...d,
    image: getFullImageUrl(request, d.image),
  }));

  return reply.send(result);
}

export async function getItemDetails(request, reply) {
  const details = await service.getItemWithDetails(request.params.id);
  if (!details) throw reply.notFound(MESSAGES.NOT_FOUND);

  details.image = getFullImageUrl(request, details.image);
  return reply.send(details);
}

export async function getSharedReposV1(request, reply) {
  const { repo } = request.query;
  const [owner, name] = String(repo).split("/");

  if (!owner || !name) {
    throw reply.badRequest("Invalid repo format. Use owner/repository");
  }

  try {
    const result = await getSharedReposV1Analytics({ owner, name });
    return reply.send(result);
  } catch (error) {
    if (error.statusCode === 404) {
      throw reply.notFound("Repository not found");
    }

    throw reply.code(502).send({
      statusCode: 502,
      error: "Bad Gateway",
      message: error.message,
    });
  }
}

export async function getSharedReposV2(request, reply) {
  const { repo } = request.query;
  const [owner, name] = String(repo).split("/");

  if (!owner || !name) {
    throw reply.badRequest("Invalid repo format. Use owner/repository");
  }

  try {
    const result = await getSharedReposV2Analytics({ owner, name });
    return reply.send(result);
  } catch (error) {
    if (error.statusCode === 404) {
      throw reply.notFound("Repository not found");
    }

    throw reply.code(502).send({
      statusCode: 502,
      error: "Bad Gateway",
      message: error.message,
    });
  }
}
