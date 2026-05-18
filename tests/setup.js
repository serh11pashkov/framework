import { loadEnvFile } from "../utils/loadEnvFile.js";

loadEnvFile(".env.test", { override: true });
