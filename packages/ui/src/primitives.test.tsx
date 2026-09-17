import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Alert, Badge, Button, KeyValueList, KeyValueRow, TONES, TONE_COLOR, Table, TabLink, Tabs, UiProvider } from "./index";

afterEach(cleanup);

describe("tones", () => {
  it("every tone maps to a badge/alert class and a Radix colour", () => {
    for (const tone of TONES) {
      const { container, unmount } = render(
        <>
          <Badge tone={tone}>b</Badge>
          <Alert tone={tone}>a</Alert>
        </>,
      );
      const badge = container.querySelector(`.badge.badge-${tone}`);
      expect(badge).not.toBeNull();
      expect(badge?.getAttribute("data-accent-color")).toBe(TONE_COLOR[tone]);
      expect(container.querySelector(`.alert.alert-${tone}`)?.getAttribute("data-accent-color")).toBe(TONE_COLOR[tone]);
      unmount();
    }
    expect(new Set(Object.values(TONE_COLOR)).size).toBe(TONES.length);
  });

  it("alerts announce warn/danger immediately and everything else politely", () => {
    const { container } = render(
      <>
        <Alert tone="danger">d</Alert>
        <Alert tone="warn">w</Alert>
        <Alert tone="ok">o</Alert>
        <Alert tone="ok" role="alert">forced</Alert>
      </>,
    );
    const roles = [...container.querySelectorAll(".alert")].map((el) => el.getAttribute("role"));
    expect(roles).toEqual(["alert", "alert", "status", "alert"]);
  });
});

describe("Button", () => {
  it("defaults to type=button and reflects active as aria-pressed", () => {
    const { container } = render(
      <>
        <Button>go</Button>
        <Button variant="secondary" active>filter</Button>
        <Button variant="danger">no</Button>
      </>,
    );
    const [plain, filter, danger] = [...container.querySelectorAll("button")];
    expect(plain?.getAttribute("type")).toBe("button");
    expect(plain?.hasAttribute("aria-pressed")).toBe(false);
    expect(filter?.className).toContain("btn btn-secondary active");
    expect(filter?.getAttribute("aria-pressed")).toBe("true");
    expect(danger?.className).toContain("btn btn-danger");
    expect(danger?.getAttribute("data-accent-color")).toBe("red");
  });
});

describe("Table, Tabs, KeyValue", () => {
  it("expose the clickable and current-page affordances", () => {
    const { container } = render(
      <UiProvider>
        <Table.Root clickable><Table.Body><Table.Row><Table.Td>x</Table.Td></Table.Row></Table.Body></Table.Root>
        <Tabs>
          <TabLink href="#/a" active>A</TabLink>
          <TabLink href="#/b" active={false}>B</TabLink>
        </Tabs>
        <KeyValueList><KeyValueRow label="Kind">refund</KeyValueRow></KeyValueList>
      </UiProvider>,
    );
    expect(container.querySelector(".table.clickable table")).not.toBeNull();
    const [a, b] = [...container.querySelectorAll("a.tab")];
    expect(a?.getAttribute("aria-current")).toBe("page");
    expect(b?.hasAttribute("aria-current")).toBe(false);
    expect(container.querySelector("dl.kv dt")?.textContent).toBe("Kind");
    expect(container.querySelector("dl.kv dd")?.textContent).toBe("refund");
  });
});
