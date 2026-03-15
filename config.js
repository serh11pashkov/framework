"use strict";

const ALLOWED_NODE_ENVS = ["development", "production"];

const errors = [];

const rawPort = process.env.PORT;
if (!rawPort) {
  errors.push("PORT is required");
} else {
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`PORT must be integer 1-65535, got "${rawPort}"`);
  }
}

if (!process.env.HOSTNAME || process.env.HOSTNAME.trim() === "") {
  errors.push("HOSTNAME is required");
}

if (!process.env.NODE_ENV) {
  errors.push("NODE_ENV is required");
} else if (!ALLOWED_NODE_ENVS.includes(process.env.NODE_ENV)) {
  errors.push(
    `NODE_ENV must be "development" or "production", got "${process.env.NODE_ENV}"`,
  );
}

if (errors.length > 0) {
  errors.forEach((e) => process.stderr.write(`[config] ${e}\n`));
  process.exit(1);
}

module.exports = {
  PORT: Number(process.env.PORT),
  HOSTNAME: process.env.HOSTNAME.trim(),
  NODE_ENV: process.env.NODE_ENV,
  IS_DEV: process.env.NODE_ENV === "development",
};
