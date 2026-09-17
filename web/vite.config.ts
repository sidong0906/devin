import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Same-origin in dev: the browser only ever talks to :5173; /api is proxied to the API.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": { target: process.env.API_URL ?? "http://localhost:4000", changeOrigin: false } },
    ...(process.env.WEB_ALLOWED_HOSTS ? { allowedHosts: process.env.WEB_ALLOWED_HOSTS.split(",") } : {}),
  },
  test: { environment: "jsdom", globals: true },
});
