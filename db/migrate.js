import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const SCHEMA_FILE = path.join(process.cwd(), "db", "schema.sql");

const splitStatements = (sql) =>
  sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

export const ensureMysqlSchema = async (pool, logger) => {
  const schemaSql = await fs.readFile(SCHEMA_FILE, "utf8");
  const currentHash = crypto.createHash("md5").update(schemaSql).digest("hex");

  for (const statement of splitStatements(schemaSql)) {
    await pool.query(statement);
  }

  const [rows] = await pool.query(
    "SELECT hash FROM migrations ORDER BY id DESC LIMIT 1",
  );
  const lastHash = rows[0]?.hash ?? null;

  if (lastHash && lastHash !== currentHash) {
    logger?.warn?.(
      "MySQL schema changed. Run migration review before production deployment.",
    );
  }

  if (lastHash !== currentHash) {
    await pool.query("INSERT INTO migrations (hash) VALUES (?)", [currentHash]);
  }
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  throw new Error("Run ensureMysqlSchema through mysql plugin");
}
