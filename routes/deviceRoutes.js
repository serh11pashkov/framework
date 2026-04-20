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
        tags: ["v1/health"],
        summary: "Basic health check",
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
      schema: {
        tags: ["v1/health"],
        summary: "Detailed health check",
      },
      onRequest: async (request, reply) => {
        if (request.headers["x-api-key"] !== fastify.config.ADMIN_API_KEY)
          throw reply.unauthorized("Invalid or missing API key");
      },
    },
    ctrl.getHealthDetails,
  );

  fastify.get(
    "/items",
    {
      schema: {
        tags: ["v1/items"],
        summary: "Get items list (v1 without pagination)",
        querystring: querySchema,
        response: { 200: devicesListResponseSchema },
      },
    },
    ctrl.getDevices,
  );

  fastify.get(
    "/items/:id",
    {
      schema: {
        tags: ["v1/items"],
        summary: "Get item by id",
        params: paramsSchema,
        response: { 200: deviceResponseSchema },
      },
    },
    ctrl.getDeviceById,
  );

  fastify.get(
    "/items/:id/details",
    {
      schema: {
        tags: ["v1/items"],
        summary: "Get item details with external reference enrichment",
        params: paramsSchema,
      },
    },
    ctrl.getItemDetails,
  );

  fastify.post(
    "/items",
    {
      schema: {
        tags: ["v1/items"],
        summary: "Create item",
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
    "/items/:id",
    {
      schema: {
        tags: ["v1/items"],
        summary: "Patch item",
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
    "/items/:id",
    {
      schema: {
        tags: ["v1/items"],
        summary: "Replace item",
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
    "/items/:id",
    {
      schema: {
        tags: ["v1/items"],
        summary: "Delete item",
        params: paramsSchema,
        response: {
          204: { type: "null" },
        },
      },
    },
    ctrl.deleteDevice,
  );

  fastify.get(
    "/items/export",
    {
      schema: {
        tags: ["v1/items"],
        summary: "Export items to CSV",
      },
    },
    ctrl.exportDevices,
  );

  fastify.post(
    "/items/import",
    {
      schema: {
        tags: ["v1/items"],
        summary: "Import items from JSON/CSV",
      },
    },
    ctrl.importDevices,
  );

  fastify.post(
    "/items/:id/image",
    {
      schema: {
        tags: ["v1/items"],
        summary: "Upload item image",
        params: paramsSchema,
      },
    },
    ctrl.uploadImage,
  );

  fastify.get(
    "/github/shared-repos",
    {
      schema: {
        tags: ["v1/github"],
        summary: "Find top repositories with most shared contributors (v1)",
        querystring: {
          type: "object",
          required: ["repo"],
          properties: {
            repo: { type: "string", minLength: 3 },
          },
          additionalProperties: false,
        },
      },
    },
    ctrl.getSharedReposV1,
  );

  // Backward compatibility aliases from previous labs.
  fastify.get(
    "/devices",
    {
      schema: {
        tags: ["v1/devices"],
        summary: "Legacy alias: get items list via /devices",
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
        tags: ["v1/devices"],
        summary: "Legacy alias: get item by id via /devices/:id",
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
        tags: ["v1/devices"],
        summary: "Legacy alias: create item via /devices",
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
        tags: ["v1/devices"],
        summary: "Legacy alias: patch item via /devices/:id",
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
        tags: ["v1/devices"],
        summary: "Legacy alias: replace item via /devices/:id",
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
        tags: ["v1/devices"],
        summary: "Legacy alias: delete item via /devices/:id",
        params: paramsSchema,
        response: { 204: { type: "null" } },
      },
    },
    ctrl.deleteDevice,
  );
  fastify.get(
    "/devices/export",
    {
      schema: {
        tags: ["v1/devices"],
        summary: "Legacy alias: export items to CSV via /devices/export",
      },
    },
    ctrl.exportDevices,
  );
  fastify.post(
    "/devices/import",
    {
      schema: {
        tags: ["v1/devices"],
        summary: "Legacy alias: import items via /devices/import",
      },
    },
    ctrl.importDevices,
  );
  fastify.post(
    "/devices/:id/image",
    {
      schema: {
        tags: ["v1/devices"],
        summary: "Legacy alias: upload item image via /devices/:id/image",
        params: paramsSchema,
      },
    },
    ctrl.uploadImage,
  );
}
