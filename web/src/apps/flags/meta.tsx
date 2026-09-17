import { Icons, type AppIconColor } from "@tools/ui";

/** Navigation identity for the flags tool, shared by the manifest entry and the page header. */
export const flagsMeta = {
  label: "Feature flags",
  description: "Propose a flag change; it publishes only when a second person approves it.",
  icon: <Icons.SwitchIcon />,
  color: "violet" as const satisfies AppIconColor,
};
