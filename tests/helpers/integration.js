import fs from "fs/promises";
import path from "path";

const usersTableSql = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const itemsTableSql = `
  CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device VARCHAR(255) NOT NULL,
    status VARCHAR(10) NOT NULL,
    room VARCHAR(255) NOT NULL,
    description TEXT,
    image VARCHAR(255),
    power VARCHAR(255)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

export const ensureTestSchema = async (app) => {
  await app.mysql.query(usersTableSql);
  await app.mysql.query(itemsTableSql);
};

export const resetTestData = async (app, { preserveUsers = false } = {}) => {
  await app.mysql.query("SET FOREIGN_KEY_CHECKS = 0");

  if (!preserveUsers) {
    await app.mysql.query("TRUNCATE TABLE users");
  }

  await app.mysql.query("TRUNCATE TABLE items");
  await app.mysql.query("SET FOREIGN_KEY_CHECKS = 1");

  await app.redis.flushdb();
};

export const seedReferenceCache = async (entries = []) => {
  const cachePath = path.join(process.cwd(), "data", "cache", "reference.json");

  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(
    cachePath,
    JSON.stringify({ cachedAt: Date.now(), data: entries }, null, 2),
    "utf8",
  );

  return cachePath;
};
