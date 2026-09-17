import type { WebApp } from "../types";
import { flagsMeta } from "./meta";
import { FlagsView } from "./FlagsView";
import { FlagChangePayloadFields } from "./FlagChangePayloadFields";

export const flagsWebApp: WebApp<"flag_change"> = {
  name: "flags",
  kind: "flag_change",
  tab: { label: flagsMeta.label, hash: "#/flags" },
  description: flagsMeta.description,
  icon: flagsMeta.icon,
  color: flagsMeta.color,
  reviewPermission: "flags.review",
  View: FlagsView,
  PayloadFields: FlagChangePayloadFields,
  approvedNote: "Flag published synchronously inside the approval transaction; no execution job is involved.",
};
