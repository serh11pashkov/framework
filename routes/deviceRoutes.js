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
          200: {
            type: "object",
            properties: { status: { type: "string" } },
          },
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
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              pid: { type: "integer" },
              nodeVersion: { type: "string" },
              platform: { type: "string" },
              uptime: { type: "number" },
              memoryUsage: {
                memoryUsage: {
                  type: "object",
                  properties: {
                    rss: { type: "number" },
                    heapTotal: { type: "number" },
                    heapUsed: { type: "number" },
                    external: { type: "number" },
                    arrayBuffers: { type: "number" },
                  },
                },
              },
            },
          },
        },
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
}
