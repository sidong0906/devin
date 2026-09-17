// Feature-flag change control: propose (optimistic version) -> independent approve -> synchronous publish.
import { defineApp } from "@tools/server-core";
import { publishApprovedFlagChange, registerFlags } from "./actions.js";
import { listFlags, registerFlagRoutes } from "./routes.js";
import { resetFlags, seedFlags } from "./seed.js";

export { flagSubjectKey, type FeatureFlagRow, type FeatureFlagsTable } from "./db.js";
export { publishApprovedFlagChange, registerFlags, listFlags, registerFlagRoutes };

export const flagsApp = defineApp({
  name: "flags",
  register: registerFlags,
  registerRoutes: registerFlagRoutes,
  seed: seedFlags,
  demoReset: resetFlags,
});
