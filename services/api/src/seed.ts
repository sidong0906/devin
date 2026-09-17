import { createAdminDb } from "@tools/server-core";
import { APPS } from "@tools/app-manifest";

export async function seed(connectionString: string): Promise<string[]> {
  const db = createAdminDb(connectionString);
  const seeded: string[] = [];
  try {
    for (const mod of APPS) {
      if (!mod.seed) continue;
      await mod.seed(db);
      seeded.push(mod.name);
    }
  } finally {
    await db.destroy();
  }
  return seeded;
}

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error("MIGRATION_DATABASE_URL is required");
  process.exit(1);
}
seed(url)
  .then((apps) => console.info(`seeded apps: ${apps.join(", ")}`))
  .catch((err) => {
    console.error("seed failed", err instanceof Error ? err.message : err);
    process.exit(1);
  });
