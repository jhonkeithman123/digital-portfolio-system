import { fileURLToPath } from "url";
import {
  getMissingSupabaseEnvVars,
  getSupabaseClient,
  isSupabaseConfigured,
} from "./client.js";
import { loadEnv } from "../config/loadEnv.js";

loadEnv();

export interface SupabasePingResult {
  ok: boolean;
  message: string;
  checkedUsers?: number;
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const canReachPostgrestWithKey = async (
  supabaseUrl: string,
  apiKey: string,
): Promise<boolean> => {
  const restUrl = `${trimTrailingSlash(supabaseUrl)}/rest/v1/`;
  const response = await fetch(restUrl, {
    method: "GET",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // 2xx => healthy, 404 is still reachable host but unexpected path.
  if (response.ok || response.status === 404) return true;
  return false;
};

export const pingSupabaseConnection = async (): Promise<SupabasePingResult> => {
  if (!isSupabaseConfigured()) {
    const missing = getMissingSupabaseEnvVars();
    return {
      ok: false,
      message: `Supabase is not configured. Missing: ${missing.join(", ")}.`,
    };
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    getSupabaseClient();

    if (supabaseUrl && serviceRoleKey) {
      const reachable = await canReachPostgrestWithKey(
        supabaseUrl,
        serviceRoleKey,
      );
      if (reachable) {
        return {
          ok: true,
          message: "Supabase connection OK (REST reachable with provided key)",
          checkedUsers: 0,
        };
      }
    }

    return {
      ok: false,
      message:
        "Supabase connection failed: REST endpoint not reachable with provided key.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: `Supabase connection error: ${message}`,
    };
  }
};

const currentFile = fileURLToPath(import.meta.url);
const directRun = process.argv[1] === currentFile;

if (directRun) {
  pingSupabaseConnection()
    .then((result) => {
      const log = result.ok ? console.log : console.error;
      log(result.message);
      if (result.ok && typeof result.checkedUsers !== "undefined") {
        console.log(`Sample users checked: ${result.checkedUsers}`);
      }
      process.exit(result.ok ? 0 : 1);
    })
    .catch((error) => {
      console.error("Supabase ping failed:", error);
      process.exit(1);
    });
}
