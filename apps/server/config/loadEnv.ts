import dotenv from "dotenv";

let loaded = false;

export const loadEnv = (): void => {
  if (loaded) {
    return;
  }

  // Load package-local env only (apps/server/.env).
  dotenv.config();

  loaded = true;
};
