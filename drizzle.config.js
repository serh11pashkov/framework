import { loadEnvFile } from "./utils/loadEnvFile.js";
import { defineConfig } from "drizzle-kit";

loadEnvFile(".env");

export default defineConfig({
  dialect: "mysql",
  schema: "./db/schema.js",
  out: "./drizzle",
  dbCredentials: {
    // eslint-disable-next-line no-restricted-syntax
    host: process.env.MYSQL_HOST,
    // eslint-disable-next-line no-restricted-syntax
    port: Number(process.env.MYSQL_PORT),
    // eslint-disable-next-line no-restricted-syntax
    user: process.env.MYSQL_USER,
    // eslint-disable-next-line no-restricted-syntax
    password: process.env.MYSQL_PASSWORD,
    // eslint-disable-next-line no-restricted-syntax
    database: process.env.MYSQL_DB,
  },
  strict: true,
  verbose: true,
});
