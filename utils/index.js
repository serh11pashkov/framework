import fs from "fs/promises";
import path from "path";

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
  const currentBackupDir = path.join(backupBaseDir, timestamp);

  try {
    await fs.mkdir(currentBackupDir, { recursive: true });
    const files = await fs.readdir(dataDir).catch(() => []);
    for (const file of files) {
      await fs.copyFile(
        path.join(dataDir, file),
        path.join(currentBackupDir, file),
      );
    }
    const backups = await fs.readdir(backupBaseDir);
    if (backups.length > 5) {
      const sorted = backups.sort((a, b) => Number(a) - Number(b));
      const toDelete = sorted.slice(0, sorted.length - 5);
      for (const old of toDelete) {
        await fs.rm(path.join(backupBaseDir, old), {
          recursive: true,
          force: true,
        });
      }
    }
  } catch (error) {
    console.error("Backup failed:", error);
  }
};
