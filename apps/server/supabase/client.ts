import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

const getEnv = () => ({
  url: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

export const getMissingSupabaseEnvVars = (): string[] => {
  const { url, serviceRoleKey } = getEnv();
  const missing: string[] = [];

  if (!url) {
    missing.push("SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
};

export const isSupabaseConfigured = (): boolean => {
  return getMissingSupabaseEnvVars().length === 0;
};

export const getSupabaseClient = (): SupabaseClient => {
  if (client) {
    return client;
  }

  const { url, serviceRoleKey } = getEnv();
  if (!url || !serviceRoleKey) {
    throw new Error(
      `Missing Supabase environment variables: ${getMissingSupabaseEnvVars().join(
        ", ",
      )}`,
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
};
