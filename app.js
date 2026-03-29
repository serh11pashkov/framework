import Fastify from "fastify";
import fastifyEnv from "@fastify/env";
import fastifyHelmet from "@fastify/helmet";
import fastifyCors from "@fastify/cors";
import fastifySensible from "@fastify/sensible";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";
import { envSchema } from "./schemas/env.schema.js";
import { deviceRoutes } from "./routes/deviceRoutes.js";
import { checkAndMigrate } from "./migrations/migrate.js";
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

  // Нові плагіни для лаби
  await fastify.register(fastifyMultipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });
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

  await fastify.register(deviceRoutes);

  // Запуск міграції та бекапу
  await checkAndMigrate(fastify.log);
  await createBackup();

  return fastify;
};
