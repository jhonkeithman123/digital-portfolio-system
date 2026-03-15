import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEnvPath = path.resolve(__dirname, "..", ".env");

let loaded = false;

export const loadEnv = (): void => {
  if (loaded) {
    return;
  }

  // Load package-local env only (apps/server/.env), regardless of process cwd.
  dotenv.config({ path: serverEnvPath });

  loaded = true;
};
