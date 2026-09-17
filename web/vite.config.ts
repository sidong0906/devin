import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Same-origin in dev: the browser only ever talks to :5173; /api is proxied to the API.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: process.env.API_URL ?? "http://localhost:4000", changeOrigin: false } } },
  test: { environment: "jsdom", globals: true },
});
