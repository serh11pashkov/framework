import fp from "fastify-plugin";
import mysql from "mysql2/promise";
import { ensureMysqlSchema } from "./migrate.js";
import {
  setDeviceRepository,
  createDeviceRepository,
} from "../repositories/deviceRepository.js";

export const connectMysql = async ({
  logger,
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DB,
}) => {
  const pool = mysql.createPool({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    const connection = await pool.getConnection();
    connection.release();

    await ensureMysqlSchema(pool, logger);

    setDeviceRepository(createDeviceRepository(pool));

    logger?.info?.("MySQL pool connected");
    return pool;
  } catch (error) {
    logger?.error?.(error, "MySQL connection error");
    await pool.end().catch(() => {});
    process.exit(1);
  }
};

async function mysqlPlugin(fastify) {
  const pool = await connectMysql({
    logger: fastify.log,
    MYSQL_HOST: fastify.config.MYSQL_HOST,
    MYSQL_PORT: fastify.config.MYSQL_PORT,
    MYSQL_USER: fastify.config.MYSQL_USER,
    MYSQL_PASSWORD: fastify.config.MYSQL_PASSWORD,
    MYSQL_DB: fastify.config.MYSQL_DB,
  });

  fastify.decorate("mysql", pool);
  fastify.decorate("db", pool);

  fastify.addHook("onClose", async () => {
    await pool.end();
    fastify.log.info("MySQL pool closed");
  });
}

export default fp(mysqlPlugin, { name: "mysql-plugin" });
