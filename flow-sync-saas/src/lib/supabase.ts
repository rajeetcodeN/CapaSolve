import { createClient } from "@supabase/supabase-js";

const isBrowser = typeof window !== "undefined";

const rawUrl = isBrowser
  ? import.meta.env.VITE_SUPABASE_URL
  : process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const projectId = isBrowser
  ? import.meta.env.VITE_SUPABASE_PROJECT_ID
  : process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID;

const anonKey = isBrowser
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = rawUrl || (projectId ? `https://${projectId}.supabase.co` : "");

if (!supabaseUrl || !anonKey) {
  const missing: string[] = [];
  if (!supabaseUrl)
    missing.push(isBrowser ? "VITE_SUPABASE_URL / VITE_SUPABASE_PROJECT_ID" : "SUPABASE_URL / SUPABASE_PROJECT_ID");
  if (!anonKey) missing.push(isBrowser ? "VITE_SUPABASE_ANON_KEY" : "SUPABASE_ANON_KEY");
  console.warn(
    `[CapaSolve] Missing Supabase environment configuration: ${missing.join(
      ", ",
    )}. Authentication and database persistence will be disabled until environment variables are configured.`,
  );
}

export const supabase = createClient(
  supabaseUrl || "https://unconfigured.supabase.co",
  anonKey || "unconfigured-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: isBrowser,
    },
  },
);

