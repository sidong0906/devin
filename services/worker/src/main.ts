import { createDb } from "@tools/server-core";
import { executorsByKind } from "@tools/app-manifest";
import { processOne } from "./jobs.js";

const POLL_MS = 500;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const db = createDb(databaseUrl, 4);
  const executors = executorsByKind();
  console.info(`worker polling every ${POLL_MS}ms, executors: ${[...executors.keys()].join(", ")}`);
  let running = true;
  const stop = () => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  while (running) {
    let didWork = false;
    try {
      didWork = await processOne(db, executors, process.env);
    } catch (err) {
      console.error("worker loop error", err instanceof Error ? err.message : err);
    }
    if (!didWork) await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
