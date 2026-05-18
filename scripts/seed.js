import { loadEnvFile } from "../utils/loadEnvFile.js";
import { connectMysql } from "../db/mysql.js";
import { createDrizzleDb, wireDeviceRepository } from "../db/drizzle.js";
import {
  clear as clearItems,
  count as countItems,
  create as createItem,
} from "../repositories/deviceRepository.js";

const DEVICES = [
  {
    device: "Smart TV",
    status: "on",
    room: "Living Room",
    description: "",
    image: null,
    power: "off",
  },
  {
    device: "Smart Camera",
    status: "on",
    room: "Hallway",
    description: "",
    image: null,
    power: "off",
  },
  {
    device: "Smart Lamp",
    status: "on",
    room: "Kitchen",
    description: "Main light",
    image: null,
    power: null,
  },
  {
    device: "Smart Thermostat",
    status: "off",
    room: "Living Room",
    description: "Nest Gen 3",
    image: null,
    power: null,
  },
  {
    device: "Smart Camera",
    status: "on",
    room: "Hallway",
    description: "Front door view",
    image: null,
    power: null,
  },
];

const logger = {
  info: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
};

loadEnvFile(".env");

const run = async () => {
  const force = process.argv.includes("--force");

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

  const db = createDrizzleDb(pool);
  wireDeviceRepository(db);

  try {
    if (force) {
      await clearItems();
      logger.info("Seed force mode: table cleared");
    } else {
      const total = await countItems();
      if (total > 0) {
        logger.info("Seed skipped: table is not empty");
        process.exit(0);
      }
    }

    for (const item of DEVICES) {
      await createItem(item);
    }

    logger.info("Database seeded");
  } finally {
    await pool.end();
  }

  process.exit(0);
};

run().catch((error) => {
  logger.error(error);
  process.exit(1);
});
