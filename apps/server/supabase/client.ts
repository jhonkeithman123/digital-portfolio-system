import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

const getEnv = () => ({
  url: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

export const isSupabaseConfigured = (): boolean => {
  const { url, serviceRoleKey } = getEnv();
  return Boolean(url && serviceRoleKey);
};

export const getSupabaseClient = (): SupabaseClient => {
  if (client) {
    return client;
  }

  const { url, serviceRoleKey } = getEnv();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
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
