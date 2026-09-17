import { assertDemoAuthAllowed } from "@tools/server-core";
import { buildApp } from "./app.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is required`);
    process.exit(1);
  }
  return v;
}

assertDemoAuthAllowed(process.env);

const { app } = buildApp({
  DATABASE_URL: requireEnv("DATABASE_URL"),
  MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL,
  SESSION_SECRET: requireEnv("SESSION_SECRET"),
  DEMO_AUTH: process.env.DEMO_AUTH,
  NODE_ENV: process.env.NODE_ENV,
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? (process.env.WEB_PORT ? `http://localhost:${process.env.WEB_PORT}` : undefined),
});

const port = Number(process.env.API_PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
