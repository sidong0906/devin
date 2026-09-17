// Web-side app manifest; mirrors packages/app-manifest on the server. Adding a tool = one entry here.
import type { RequestKind } from "@tools/contracts";
import type { WebApp } from "./types";
import { refundsWebApp } from "./refunds";
import { flagsWebApp } from "./flags";

export const WEB_APPS: readonly WebApp[] = [refundsWebApp, flagsWebApp] as readonly WebApp[];

export function appForKind(kind: RequestKind): WebApp | undefined {
  return WEB_APPS.find((a) => a.kind === kind);
}

export function appForHash(hash: string): WebApp | undefined {
  return WEB_APPS.find((a) => a.tab.hash === hash);
}
