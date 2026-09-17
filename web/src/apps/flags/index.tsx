import type { WebApp } from "../types";
import { FlagsView } from "./FlagsView";
import { FlagChangePayloadFields } from "./FlagChangePayloadFields";

export const flagsWebApp: WebApp<"flag_change"> = {
  name: "flags",
  kind: "flag_change",
  tab: { label: "Feature flags", hash: "#/flags" },
  reviewPermission: "flags.review",
  View: FlagsView,
  PayloadFields: FlagChangePayloadFields,
  approvedNote: "Flag published synchronously inside the approval transaction; no execution job is involved.",
};
