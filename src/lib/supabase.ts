import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Local-dev no-op stub: when Supabase env vars aren't set, return a client whose
// auth methods resolve to "logged out" instead of throwing. This lets the app
// boot and render UI (e.g. /backtest preview) without a real Supabase project.
function createNoopClient(): SupabaseClient {
  const noSession = { data: { session: null }, error: null };
  const noUser = { data: { user: null }, error: null };
  const stub: any = {
    auth: {
      getSession: async () => noSession,
      getUser: async () => noUser,
      onAuthStateChange: (_cb: unknown) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInWithOtp: async () => ({ data: null, error: new Error("Supabase not configured") }),
      signInWithPassword: async () => ({ data: null, error: new Error("Supabase not configured") }),
      signOut: async () => ({ error: null }),
    },
  };
  return stub as SupabaseClient;
}

export const supabase: SupabaseClient =
  !url || !anonKey
    ? (console.warn(
        "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — auth will be a no-op"
      ),
      createNoopClient())
    : createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "tradelab-auth",
        },
      });

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
