import dotenv from "dotenv";
import path from "path";

let loaded = false;

export const loadEnv = (): void => {
  if (loaded) {
    return;
  }

  // First load package-local env, then fallback to root-level env for monorepo runs.
  dotenv.config();
  dotenv.config({
    path: path.resolve(process.cwd(), "../../.env"),
    override: false,
  });

  loaded = true;
};
