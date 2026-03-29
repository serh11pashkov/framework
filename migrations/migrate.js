import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { DeviceModel } from "../models/item.model.js";
import { writeAtomic } from "../utils/index.js";

const DATA_DIR = path.join(process.cwd(), "data");
const ITEMS_DIR = path.join(DATA_DIR, "items");
const VERSION_FILE = path.join(DATA_DIR, "version.json");

export const checkAndMigrate = async (logger) => {
  await fs.mkdir(ITEMS_DIR, { recursive: true });
  const currentHash = crypto
    .createHash("md5")
    .update(JSON.stringify(Object.keys(DeviceModel).sort()))
    .digest("hex");
  let storedHash = null;

  try {
    const versionData = await fs.readFile(VERSION_FILE, "utf8");
    storedHash = JSON.parse(versionData).hash;
  } catch {
    //
  }

  if (currentHash !== storedHash) {
    if (logger) logger.warn("Data schema changed. Migrating existing files...");
    const files = await fs.readdir(ITEMS_DIR);
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const filePath = path.join(ITEMS_DIR, file);
      const data = JSON.parse(await fs.readFile(filePath, "utf8"));
      await writeAtomic(filePath, { ...DeviceModel, ...data });
    }
    await fs.writeFile(VERSION_FILE, JSON.stringify({ hash: currentHash }));
  }
};

if (process.argv[1] === new URL(import.meta.url).pathname) checkAndMigrate();
