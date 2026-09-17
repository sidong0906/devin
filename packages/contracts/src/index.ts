/**
 * FROZEN CONTRACT. Owned by the coordinator; server, web, and acceptance tests all build against it.
 * A child session that needs a change here must stop and report it instead of editing.
 *
 * platform.ts  cross-app: identity, permissions, action names, errors, approval/audit DTOs
 * refunds.ts   refunds app: payload, payment DTO, request body, seed
 * flags.ts     feature-flags app: payload, flag DTO, propose body, seed
 */
export * from "./platform.js";
export * from "./refunds.js";
export * from "./flags.js";
export * from "./masking.js";
import { PLATFORM_ROUTES } from "./platform.js";
import { REFUND_ROUTES } from "./refunds.js";
import { FLAG_ROUTES } from "./flags.js";

export const ROUTES = { ...PLATFORM_ROUTES, ...REFUND_ROUTES, ...FLAG_ROUTES } as const;
