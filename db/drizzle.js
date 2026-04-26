import fp from "fastify-plugin";
import { drizzle } from "drizzle-orm/mysql2";
import {
  setDeviceRepository,
  createDeviceRepository,
} from "../repositories/deviceRepository.js";

export const createDrizzleDb = (pool) => drizzle(pool);

export const wireDeviceRepository = (db) => {
  setDeviceRepository(createDeviceRepository(db));
};

async function drizzlePlugin(fastify) {
  if (!fastify.mysql) {
    throw new Error("MySQL pool is not initialized");
  }

  const db = createDrizzleDb(fastify.mysql);
  wireDeviceRepository(db);

  fastify.decorate("db", db);
  fastify.log.info("Drizzle connected");
}

export default fp(drizzlePlugin, {
  name: "drizzle-plugin",
  dependencies: ["mysql-plugin"],
});
