import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    ...(command === "build"
      ? [
          nitro({
            preset: "vercel",
            output: {
              dir: ".vercel/output",
              serverDir: ".vercel/output/functions/__server.func",
              publicDir: ".vercel/output/static",
            },
          }),
        ]
      : []),
    react(),
  ],
  server: {
    proxy: {
      "/api/auth": {
        target: "https://ep-hidden-fog-b4pl0nab.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, ""),
        secure: true,
        cookieDomainRewrite: "",
      },
    },
  },
}));
