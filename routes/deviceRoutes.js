import * as ctrl from "#controllers";
import {
  createBodySchema,
  patchBodySchema,
  replaceBodySchema,
  querySchema,
  paramsSchema,
  deviceResponseSchema,
  devicesListResponseSchema,
  deviceProperties,
} from "#schemas/device";

export async function deviceRoutes(fastify) {
  fastify.get(
    "/health",
    {
      schema: {
        response: {
          200: { type: "object", properties: { status: { type: "string" } } },
        },
      },
    },
    ctrl.getHealth,
  );

  fastify.get(
    "/health/details",
    {
      onRequest: async (request, reply) => {
        if (request.headers["x-api-key"] !== fastify.config.ADMIN_API_KEY)
          throw reply.unauthorized("Invalid or missing API key");
      },
    },
    ctrl.getHealthDetails,
  );

  fastify.get(
    "/devices",
    {
      schema: {
        querystring: querySchema,
        response: { 200: devicesListResponseSchema },
      },
    },
    ctrl.getDevices,
  );

  fastify.get(
    "/devices/:id",
    {
      schema: {
        params: paramsSchema,
        response: { 200: deviceResponseSchema },
      },
    },
    ctrl.getDeviceById,
  );

  fastify.post(
    "/devices",
    {
      schema: {
        body: createBodySchema,
        response: {
          201: {
            type: "object",
            properties: {
              message: { type: "string" },
              device: { type: "object", properties: deviceProperties },
            },
          },
        },
      },
    },
    ctrl.createDevice,
  );

  fastify.patch(
    "/devices/:id",
    {
      schema: {
        params: paramsSchema,
        body: patchBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
              device: { type: "object", properties: deviceProperties },
            },
          },
        },
      },
    },
    ctrl.patchDevice,
  );

  fastify.put(
    "/devices/:id",
    {
      schema: {
        params: paramsSchema,
        body: replaceBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
              device: { type: "object", properties: deviceProperties },
            },
          },
        },
      },
    },
    ctrl.replaceDevice,
  );

  fastify.delete(
    "/devices/:id",
    {
      schema: {
        params: paramsSchema,
        response: {
          200: {
            type: "object",
            properties: { message: { type: "string" } },
          },
        },
      },
    },
    ctrl.deleteDevice,
  );

  // ================= НОВІ ЕНДПОЇНТИ ДЛЯ ЛАБИ 5 =================

  // Експорт CSV
  fastify.get("/devices/export", ctrl.exportDevices);

  // Імпорт (без суворої схеми в Fastify, бо це multipart, валідація в контролері)
  fastify.post("/devices/import", ctrl.importDevices);

  // Завантаження фото
  fastify.post(
    "/devices/:id/image",
    {
      schema: {
        params: paramsSchema,
      },
    },
    ctrl.uploadImage,
  );
}
