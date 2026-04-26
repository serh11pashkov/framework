import { connectMongo } from "../db/mongo.js";
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

const run = async () => {
  const force = process.argv.includes("--force");

  await connectMongo({
    logger,
    // eslint-disable-next-line no-restricted-syntax
    MONGO_URL: process.env.MONGO_URL,
    // eslint-disable-next-line no-restricted-syntax
    MONGO_DB_NAME: process.env.MONGO_DB_NAME,
  });

  if (force) {
    await clearItems();
    logger.info("Seed force mode: collection cleared");
  } else {
    const total = await countItems();
    if (total > 0) {
      logger.info("Seed skipped: collection is not empty");
      process.exit(0);
    }
  }

  for (const item of DEVICES) {
    await createItem(item);
  }

  logger.info("Database seeded");
  process.exit(0);
};

run().catch((error) => {
  logger.error(error);
  process.exit(1);
});
