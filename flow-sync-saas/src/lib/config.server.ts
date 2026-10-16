import process from "node:process";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.
//
// When to use which env-access pattern:
//   - .server.ts module (this file): server-only helpers reused across
//     handlers. Wrap reads in a function so they run per-request.
//   - inline process.env inside a createServerFn handler: one-off reads
//     not reused elsewhere.
//   - import.meta.env.VITE_FOO: PUBLIC config readable from both client
//     and server (analytics IDs, public URLs). Define in .env with the
//     VITE_ prefix. Never put secrets here — they ship to the browser.

export function getServerConfig() {
  const projectId = process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const bucketName = process.env.SUPABASE_BUCKET_NAME || "scheduler";

  if (!projectId || !anonKey) {
    const missing: string[] = [];
    if (!projectId) missing.push("SUPABASE_PROJECT_ID");
    if (!anonKey) missing.push("SUPABASE_ANON_KEY");
    throw new Error(
      `Server configuration error: Missing required Supabase environment variable(s): ${missing.join(", ")}.`,
    );
  }

  return {
    nodeEnv: process.env.NODE_ENV,
    supabaseProjectId: projectId,
    supabaseAnonKey: anonKey,
    supabaseBucketName: bucketName,
  };
}
