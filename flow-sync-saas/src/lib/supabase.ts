import { createClient } from "@supabase/supabase-js";

// Grab Supabase configurations depending on environment (Browser vs Node server)
const projectId =
  typeof window !== "undefined"
    ? import.meta.env.VITE_SUPABASE_PROJECT_ID || "ymvdbaexgtxjjrpodiwf"
    : process.env.SUPABASE_PROJECT_ID || "ymvdbaexgtxjjrpodiwf";

const anonKey =
  typeof window !== "undefined"
    ? import.meta.env.VITE_SUPABASE_ANON_KEY || ""
    : process.env.SUPABASE_ANON_KEY || "";

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: typeof window !== "undefined",
  },
});
