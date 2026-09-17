import type { ComponentType, ReactNode } from "react";
import type { Actor, Permission, RequestKind, RequestPayload } from "@tools/contracts";
import type { AppIconColor } from "@tools/ui";

export type ViewProps = { actor: Actor; onNavigate: (hash: string) => void };

/** What one internal tool contributes to the shared shell: a tab and how its request kind renders in the approvals detail. */
export interface WebApp<K extends RequestKind = RequestKind> {
  name: string;
  kind: K;
  tab: { label: string; hash: string };
  /** One line for the Overview and the page header. */
  description: string;
  /** Navigation identity: glyph plus a Radix colour scale. Chosen per tool, not per status. */
  icon: ReactNode;
  color: AppIconColor;
  /** Permission the server checks in this kind's review policy; used only to hide buttons the server would refuse. */
  reviewPermission: Permission;
  View: ComponentType<ViewProps>;
  PayloadFields: ComponentType<{ payload: Extract<RequestPayload, { kind: K }> }>;
  /** Shown on the request detail once approved, for kinds that publish inside the decide transaction. */
  approvedNote: string | null;
}
