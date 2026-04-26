export const envSchema = {
  type: "object",
  required: [
    "PORT",
    "HOSTNAME",
    "NODE_ENV",
    "ADMIN_API_KEY",
    "MONGO_URL",
    "MONGO_DB_NAME",
  ],
  properties: {
    PORT: { type: "string", pattern: "^[0-9]+$" },
    HOSTNAME: { type: "string", minLength: 1 },
    NODE_ENV: { type: "string", enum: ["development", "production"] },
    ADMIN_API_KEY: { type: "string", minLength: 1 },
    MONGO_URL: { type: "string", minLength: 1 },
    MONGO_DB_NAME: { type: "string", minLength: 1 },
    EXTERNAL_BASE_URL: { type: "string", minLength: 1 },
    GITHUB_TOKEN: { type: "string", minLength: 1 },
  },
  additionalProperties: true,
};
