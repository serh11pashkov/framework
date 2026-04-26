import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import { createGzip } from "zlib";

export const writeAtomic = async (filePath, data) => {
  const tmp = `${filePath}.tmp`;
  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, filePath);
  } catch (error) {
    try {
      await fs.unlink(tmp);
    } catch {
      //
    }
    throw error;
  }
};

export const getFullImageUrl = (request, imagePath) => {
  if (!imagePath) return null;
  return `${request.protocol}://${request.headers.host}/uploads${imagePath}`;
};

export const createBackup = async () => {
  const dataDir = path.join(process.cwd(), "data", "items");
  const backupBaseDir = path.join(process.cwd(), "data", "backups");
  const timestamp = Date.now().toString();
  const backupFilePath = path.join(backupBaseDir, `${timestamp}.gz`);

  const backupSource = async function* () {
    const files = (await fs.readdir(dataDir).catch(() => []))
      .filter((file) => file.endsWith(".json"))
      .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const reader = createReadStream(filePath);

      for await (const chunk of reader) {
        yield chunk;
      }

      yield "\n";
    }
  };

  try {
    await fs.mkdir(backupBaseDir, { recursive: true });

    await pipeline(
      Readable.from(backupSource()),
      createGzip(),
      createWriteStream(backupFilePath),
    );

    const entries = await fs.readdir(backupBaseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        await fs.rm(path.join(backupBaseDir, entry.name), {
          recursive: true,
          force: true,
        });
      }
    }

    const backups = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".gz"))
      .map((entry) => entry.name)
      .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

    if (backups.length > 5) {
      const toDelete = backups.slice(0, backups.length - 5);
      for (const old of toDelete) {
        await fs.rm(path.join(backupBaseDir, old), { force: true });
      }
    }
  } catch (error) {
    console.error("Backup failed:", error);
  }
};

export const getBackupFilePathByTimestamp = async (timestamp) => {
  const backupBaseDir = path.join(process.cwd(), "data", "backups");
  const normalizedTimestamp = String(timestamp).replace(/\.gz$/i, "");
  const filePath = path.join(backupBaseDir, `${normalizedTimestamp}.gz`);

  await fs.access(filePath);
  return filePath;
};
