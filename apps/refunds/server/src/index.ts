import { defineApp } from "@tools/server-core";
import { registerRefunds } from "./actions.js";
import { registerRefundRoutes } from "./routes.js";
import { refundExecutor } from "./executor.js";
import { seedRefunds } from "./seed.js";

export { refundIdempotencyKey, refundSubjectKey, toPaymentDto } from "./db.js";
export { registerRefunds, registerRefundRoutes, refundExecutor };

export const refundsApp = defineApp({
  name: "refunds",
  register: registerRefunds,
  registerRoutes: registerRefundRoutes,
  seed: seedRefunds,
  executors: [refundExecutor],
});
