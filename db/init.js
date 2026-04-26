import { connectMysql } from "./mysql.js";

const logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const run = async () => {
  const pool = await connectMysql({
    logger,
    // eslint-disable-next-line no-restricted-syntax
    MYSQL_HOST: process.env.MYSQL_HOST,
    // eslint-disable-next-line no-restricted-syntax
    MYSQL_PORT: process.env.MYSQL_PORT,
    // eslint-disable-next-line no-restricted-syntax
    MYSQL_USER: process.env.MYSQL_USER,
    // eslint-disable-next-line no-restricted-syntax
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    // eslint-disable-next-line no-restricted-syntax
    MYSQL_DB: process.env.MYSQL_DB,
  });

  await pool.end();
};

run().catch((error) => {
  logger.error(error);
  process.exit(1);
});
