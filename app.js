import Fastify from "fastify";
import fastifyEnv from "@fastify/env";
import fastifyHelmet from "@fastify/helmet";
import fastifyCors from "@fastify/cors";
import fastifySensible from "@fastify/sensible";
import { envSchema } from "./schemas/env.schema.js";
import { deviceRoutes } from "./routes/deviceRoutes.js";

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
    origin:
      fastify.config.NODE_ENV === "production" ? "https://example.com" : "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  });

  await fastify.register(fastifySensible);

  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error({ err: error, method: request.method, url: request.url });

    reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: error.name,
      message: error.message,
    });
  });

  await fastify.register(deviceRoutes);

  fastify.addHook("onClose", async (instance) => {
    instance.log.info("Server closed gracefully");
  });

  return fastify;
};
