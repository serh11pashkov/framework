import Fastify from "fastify";
import fastifyEnv from "@fastify/env";
import fastifyHelmet from "@fastify/helmet";
import fastifyCors from "@fastify/cors";
import fastifySensible from "@fastify/sensible";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyWebsocket from "@fastify/websocket";
import path from "path";
import mysqlPlugin from "./db/mysql.js";
import drizzlePlugin from "./db/drizzle.js";
import { envSchema } from "./schemas/env.schema.js";
import { deviceRoutes } from "./routes/deviceRoutes.js";
import { apiV2Routes } from "./routes/apiV2Routes.js";
import { createBackup } from "./utils/index.js";

export const buildApp = async () => {
  // eslint-disable-next-line no-restricted-syntax
  const NODE_ENV = process.env.NODE_ENV;
  const fastify = Fastify({
    logger: {
      level: NODE_ENV === "production" ? "error" : "info",
      transport:
        NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
    },
  });

  await fastify.register(fastifyEnv, { schema: envSchema, dotenv: true });
  await fastify.register(fastifyHelmet, { global: true });
  await fastify.register(fastifyCors, {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  });
  await fastify.register(fastifySensible);
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Rate limit exceeded, retry later",
    }),
  });
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Smart Home API",
        version: "2.0.0",
        description: "API documentation for Smart Home service",
      },
      servers: [
        {
          url: "http://localhost:3000",
        },
      ],
      tags: [
        { name: "v1/health", description: "Health checks for API v1" },
        {
          name: "v1/items",
          description: "Legacy item endpoints in API v1",
        },
        {
          name: "v1/devices",
          description: "Backward-compatible alias endpoints for API v1",
        },
        {
          name: "v1/github",
          description: "GitHub analytics endpoints in API v1",
        },
        {
          name: "v2/items",
          description: "New item endpoints in API v2 with pagination",
        },
        {
          name: "v2/github",
          description: "GitHub analytics endpoints in API v2",
        },
      ],
    },
  });
  await fastify.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  await fastify.register(fastifyMultipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });
  await fastify.register(fastifyWebsocket);
  await fastify.register(mysqlPlugin);
  await fastify.register(drizzlePlugin);
  await fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), "uploads"),
    prefix: "/uploads/",
  });

  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error({ err: error, method: request.method, url: request.url });
    reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: error.name,
      message: error.message,
    });
  });

  await fastify.register(deviceRoutes, { prefix: "/api/v1" });
  await fastify.register(apiV2Routes, { prefix: "/api/v2" });

  await createBackup();

  return fastify;
};
