import Ajv from "ajv";
import { ALLOWED_NODE_ENVS } from "#constants";

const ajv = new Ajv({ allErrors: true });

const envSchema = {
  type: "object",
  required: ["PORT", "HOSTNAME", "NODE_ENV"],
  properties: {
    PORT: { type: "string", pattern: "^[0-9]+$" },
    HOSTNAME: { type: "string", minLength: 1 },
    NODE_ENV: { type: "string", enum: ALLOWED_NODE_ENVS },
  },
  additionalProperties: true,
};

const validate = ajv.compile(envSchema);
const valid = validate(process.env);

if (!valid) {
  validate.errors.forEach((e) =>
    process.stderr.write(`[config] ${e.instancePath} ${e.message}\n`),
  );
  process.exit(1);
}

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write(
    `[config] PORT must be integer 1–65535, got "${process.env.PORT}"\n`,
  );
  process.exit(1);
}

export default {
  PORT: port,
  HOSTNAME: process.env.HOSTNAME.trim(),
  NODE_ENV: process.env.NODE_ENV,
  IS_DEV: process.env.NODE_ENV === "development",
};
