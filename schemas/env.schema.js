export const envSchema = {
  type: "object",
  required: ["PORT", "HOSTNAME", "NODE_ENV", "ADMIN_API_KEY"],
  properties: {
    PORT: { type: "string", pattern: "^[0-9]+$" },
    HOSTNAME: { type: "string", minLength: 1 },
    NODE_ENV: { type: "string", enum: ["development", "production"] },
    ADMIN_API_KEY: { type: "string", minLength: 1 },
  },
  additionalProperties: true,
};
