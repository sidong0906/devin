import type { ComponentProps, ReactNode } from "react";
import { Card as RCard, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { cx } from "../tone";

/** Bordered container for one concern (payload, decision, timeline). Use `<CardTitle>` for its heading. */
export function Card({ className, ...rest }: ComponentProps<typeof RCard>) {
  return <RCard asChild variant="surface" size="2" my="3" className={cx("card", className)}><section {...rest} /></RCard>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <Heading as="h3" size="1" color="gray" weight="medium" mb="2" mt="4" className="card-title" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{children}</Heading>;
}

/** Two equal columns; collapses to one on narrow screens. */
export function Grid2({ className, ...rest }: ComponentProps<typeof Grid>) {
  return <Grid columns={{ initial: "1", md: "2" }} gap="3" className={cx("grid-2", className)} {...rest} />;
}

/** Heading row with optional right-aligned controls. */
export function SectionHead({ heading, children, className, ...rest }: ComponentProps<typeof Flex> & { heading: ReactNode }) {
  return (
    <Flex align="center" justify="between" gap="3" wrap="wrap" my="3" className={cx("section-head", className)} {...rest}>
      <Heading as="h2" size="5">{heading}</Heading>
      {children}
    </Flex>
  );
}

/** Dashed placeholder for "nothing here". */
export function EmptyState({ className, ...rest }: ComponentProps<"p">) {
  return <p className={cx("empty", className)} {...rest} />;
}

/** Muted one-liner while data is loading; use in place of spinners. */
export function Loading({ children = "Loading…" }: { children?: ReactNode }) {
  return <Text as="p" color="gray" className="muted">{children}</Text>;
}
