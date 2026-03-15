import { fileURLToPath } from "url";
import {
  getMissingSupabaseEnvVars,
  getSupabaseClient,
  isSupabaseConfigured,
} from "./client";
import { loadEnv } from "../config/loadEnv";

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
    const supabase = getSupabaseClient();
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) {
      // Some projects intentionally use anon/limited keys in development.
      // In that case admin APIs fail even though Supabase is reachable.
      if (supabaseUrl && serviceRoleKey) {
        const reachable = await canReachPostgrestWithKey(
          supabaseUrl,
          serviceRoleKey,
        );
        if (reachable) {
          return {
            ok: true,
            message:
              "Supabase connection OK (REST reachable with provided key; admin scope not granted)",
          };
        }
      }

      return {
        ok: false,
        message: `Supabase admin API failed: ${error.message}`,
      };
    }

    return {
      ok: true,
      message: "Supabase connection OK (auth admin reachable)",
      checkedUsers: data?.users?.length ?? 0,
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
