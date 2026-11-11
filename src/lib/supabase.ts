import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

/**
 * Client Supabase. Les types de lignes sont définis dans les modules `api.ts` ;
 * `npm run db:types` peut générer les types officiels si vous liez la CLI Supabase.
 */
export const supabase = createClient(url ?? "http://localhost", anonKey ?? "missing", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
