import { Icons, type AppIconColor } from "@tools/ui";

/** Navigation identity for the refunds tool, shared by the manifest entry and the page header. */
export const refundsMeta = {
  label: "Refunds",
  description: "Captured payments; request a full refund that an independent reviewer must approve.",
  icon: <Icons.ReloadIcon />,
  color: "teal" as const satisfies AppIconColor,
};
