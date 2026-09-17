import { z } from "zod";

export const FlagChangePayload = z.object({
  kind: z.literal("flag_change"),
  flagKey: z.string(),
  expectedVersion: z.number().int().nonnegative(),
  newValue: z.boolean(),
});

/** Published feature flag. `version` is the optimistic-concurrency token proposals must name. */
export const FlagDto = z.object({
  key: z.string(),
  value: z.boolean(),
  version: z.number().int().nonnegative(),
  updatedAt: z.string(),
  updatedById: z.string().nullable(),
  pendingRequestId: z.string().nullable(),
});
export type FlagDto = z.infer<typeof FlagDto>;
export const FlagsResponse = z.object({ flags: z.array(FlagDto) });

export const FlagProposeBody = z.object({ flagKey: z.string().min(1), expectedVersion: z.number().int().nonnegative(), newValue: z.boolean() }).strict();

export const FLAG_ROUTES = {
  flags: "GET /api/flags",
  flagPropose: "POST /api/actions/flags.propose",
} as const;

export const SEED_FLAGS = [
  { key: "refunds.instant_small_amounts", value: false },
  { key: "kyc.enhanced_review", value: true },
  { key: "ui.new_dashboard", value: false },
] as const;
