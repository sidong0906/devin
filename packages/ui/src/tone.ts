/**
 * Semantic tone shared by Badge, Alert and any future status element.
 *
 *  ok       confirmed success. Use only when the server has confirmed the outcome.
 *  warn     unresolved, needs a human. Never a success, never a failure.
 *  danger   denied, rejected, or failed.
 *  pending  in progress or waiting on someone.
 *  neutral  informational; nothing has happened.
 */
export type Tone = "ok" | "warn" | "danger" | "pending" | "neutral";

export const TONES: readonly Tone[] = ["ok", "warn", "danger", "pending", "neutral"];

/** Radix colour scale behind each tone. The only tone→colour mapping in the codebase. */
export const TONE_COLOR = {
  ok: "green",
  warn: "amber",
  danger: "red",
  pending: "indigo",
  neutral: "gray",
} as const satisfies Record<Tone, string>;

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
