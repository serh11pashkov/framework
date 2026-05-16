import fs from "fs/promises";
import os from "os";
import path from "path";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createBackup,
  getBackupFilePathByTimestamp,
  getFullImageUrl,
  writeAtomic,
} from "../../utils/index.js";

describe("utils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a full image url from the request host", () => {
    const request = {
      protocol: "https",
      headers: { host: "example.com:3000" },
    };

    expect(getFullImageUrl(request, "/1/image.jpg")).toBe(
      "https://example.com:3000/uploads/1/image.jpg",
    );
  });

  it("writes data atomically", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "smart-home-"));
    const filePath = path.join(tmpDir, "nested", "payload.json");

    await writeAtomic(filePath, { ok: true });

    const content = JSON.parse(await fs.readFile(filePath, "utf8"));
    expect(content).toEqual({ ok: true });
  });

  it("resolves existing backup paths", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "smart-home-"));
    const backupDir = path.join(tmpDir, "data", "backups");
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(path.join(backupDir, "123.gz"), "backup");

    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

    await expect(getBackupFilePathByTimestamp("123")).resolves.toBe(
      path.join(backupDir, "123.gz"),
    );
  });

  it("creates a compressed backup from items", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "smart-home-"));
    const itemsDir = path.join(tmpDir, "data", "items");
    const backupDir = path.join(tmpDir, "data", "backups");
    await fs.mkdir(itemsDir, { recursive: true });
    await fs.writeFile(
      path.join(itemsDir, "1.json"),
      JSON.stringify({ id: 1 }),
    );
    await fs.writeFile(
      path.join(itemsDir, "2.json"),
      JSON.stringify({ id: 2 }),
    );
    await fs.mkdir(path.join(backupDir, "old-folder"), { recursive: true });

    for (const timestamp of ["1", "2", "3", "4", "5", "6"]) {
      await fs.writeFile(path.join(backupDir, `${timestamp}.gz`), "backup");
    }

    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

    await createBackup();

    const backups = await fs.readdir(backupDir);
    expect(backups.some((file) => file.endsWith(".gz"))).toBe(true);
    expect(backups).not.toContain("old-folder");
    expect(backups.filter((file) => file.endsWith(".gz"))).toHaveLength(5);
  });
});
