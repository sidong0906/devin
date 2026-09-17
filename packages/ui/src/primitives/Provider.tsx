import type { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";

/**
 * Wrap the app root once. Sets the Radix theme every primitive reads its variables from.
 * Fixed here on purpose: tools should look the same, not pick their own accent.
 */
export function UiProvider({ children }: { children: ReactNode }) {
  return (
    <Theme accentColor="indigo" grayColor="slate" radius="medium" scaling="95%" panelBackground="solid">
      {children}
    </Theme>
  );
}
