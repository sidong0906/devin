import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Alert, Badge, Button, TONES, Table, TabLink } from "./index";

afterEach(cleanup);

describe("tones", () => {
  it("every tone maps to a badge and alert class", () => {
    for (const tone of TONES) {
      const { container, unmount } = render(
        <>
          <Badge tone={tone}>b</Badge>
          <Alert tone={tone}>a</Alert>
        </>,
      );
      expect(container.querySelector(`.badge.badge-${tone}`)).not.toBeNull();
      expect(container.querySelector(`.alert.alert-${tone}`)).not.toBeNull();
      unmount();
    }
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
    expect(filter?.className).toBe("btn btn-secondary active");
    expect(filter?.getAttribute("aria-pressed")).toBe("true");
    expect(danger?.className).toBe("btn btn-danger");
  });
});

describe("Table and TabLink", () => {
  it("expose the clickable and current-page affordances", () => {
    const { container } = render(
      <>
        <Table clickable><tbody><tr><td>x</td></tr></tbody></Table>
        <TabLink href="#/a" active>A</TabLink>
        <TabLink href="#/b" active={false}>B</TabLink>
      </>,
    );
    expect(container.querySelector("table")?.className).toBe("table clickable");
    const [a, b] = [...container.querySelectorAll("a")];
    expect(a?.getAttribute("aria-current")).toBe("page");
    expect(b?.hasAttribute("aria-current")).toBe(false);
  });
});
