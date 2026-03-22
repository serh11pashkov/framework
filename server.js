import { buildApp } from "./app.js";

const start = async () => {
  const fastify = await buildApp();

  const gracefulShutdown = async (signal) => {
    fastify.log.info(`Received signal: ${signal}`);
    setTimeout(() => process.exit(1), 10000).unref();
    await fastify.close();
    process.exit(0);
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  process.on("uncaughtException", (err) => {
    fastify.log.fatal({ err }, "Uncaught exception — shutting down");
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    fastify.log.fatal({ reason }, "Unhandled rejection — shutting down");
    process.exit(1);
  });

  await fastify.listen({
    port: fastify.config.PORT,
    host: fastify.config.HOSTNAME,
  });
};

start();
