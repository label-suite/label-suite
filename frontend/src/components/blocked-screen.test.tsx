/**
 * The shared not-found and denied screen (specs/denied-and-not-found-screens).
 * The copy below is illustrative: the component has no text of its own, so
 * each test passes the sentences a page would pass, and builds the description
 * with `Trans` plus the `identifier` component, as a page does (design D4).
 */
import type { ReactNode } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Trans } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BlockedIdentifier, BlockedScreen, type BlockedScreenProps } from "./blocked-screen";

const IDENTIFIER = "demo-task-001";
const NOT_FOUND_TITLE = "找不到這個任務";
const NOT_FOUND_TEMPLATE = "任務代碼 <identifier/> 不存在，請確認網址或回到儀表板重新選擇任務。";
const DENIED_TITLE = "無權限檢視此任務";
const DENIED_TEMPLATE = "你目前無權限檢視任務代碼 <identifier/>，請回到儀表板或聯絡管理員。";
const BACK_TO = "/dashboard/dashboard";
const BACK_LABEL = "回儀表板";

/** A description with the identifier slotted in through `Trans`, as a page builds it. */
function describedWith(template: string, identifier: string): ReactNode {
  return (
    <Trans
      i18nKey="blockedScreenTest.description"
      defaults={template}
      components={{ identifier: <BlockedIdentifier value={identifier} /> }}
    />
  );
}

/** Renders the screen inside a router, since its way back is a router link. */
function renderScreen(props: BlockedScreenProps) {
  return render(
    <MemoryRouter>
      <BlockedScreen {...props} />
    </MemoryRouter>,
  );
}

function notFoundProps(identifier = IDENTIFIER): BlockedScreenProps {
  return {
    kind: "notFound",
    title: NOT_FOUND_TITLE,
    description: describedWith(NOT_FOUND_TEMPLATE, identifier),
    backTo: BACK_TO,
    backLabel: BACK_LABEL,
  };
}

function deniedProps(): BlockedScreenProps {
  return {
    kind: "denied",
    title: DENIED_TITLE,
    description: describedWith(DENIED_TEMPLATE, IDENTIFIER),
    backTo: BACK_TO,
    backLabel: BACK_LABEL,
  };
}

/** The paragraph whose whole text, nested elements included, equals `text`. */
function descriptionWithText(region: HTMLElement, text: string): HTMLElement {
  return within(region).getByText(
    (_content, element) => element?.tagName === "P" && element.textContent === text,
  );
}

describe("BlockedScreen", () => {
  it("shows the not-found screen with one heading, the description and one way back", () => {
    renderScreen(notFoundProps());

    const region = screen.getByRole("region", { name: NOT_FOUND_TITLE });
    expect(region).toHaveAttribute("data-kind", "notFound");
    const headings = within(region).getAllByRole("heading");
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(NOT_FOUND_TITLE);
    expect(headings[0]).not.toHaveTextContent(IDENTIFIER);
    expect(
      descriptionWithText(
        region,
        "任務代碼 demo-task-001 不存在，請確認網址或回到儀表板重新選擇任務。",
      ),
    ).toBeInTheDocument();
    const links = within(region).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(BACK_LABEL);
    expect(links[0]).toHaveAttribute("href", BACK_TO);
    expect(within(region).queryByRole("button")).not.toBeInTheDocument();
    expect(within(region).queryByRole("textbox")).not.toBeInTheDocument();
    expect(region.querySelector("svg, img, input, form")).toBeNull();
  });

  it("shows the denied screen that says who to contact, with no retry", () => {
    renderScreen(deniedProps());

    const region = screen.getByRole("region", { name: DENIED_TITLE });
    expect(region).toHaveAttribute("data-kind", "denied");
    expect(within(region).getByRole("heading")).toHaveTextContent(DENIED_TITLE);
    expect(
      descriptionWithText(
        region,
        "你目前無權限檢視任務代碼 demo-task-001，請回到儀表板或聯絡管理員。",
      ),
    ).toBeInTheDocument();
    const link = within(region).getByRole("link");
    expect(link).toHaveAccessibleName(BACK_LABEL);
    expect(link).toHaveAttribute("href", BACK_TO);
    expect(within(region).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the unspecified description without an identifier element when the URL has none", () => {
    renderScreen({
      kind: "notFound",
      title: "尚未選擇任務",
      description: "未指定任務，請回到儀表板重新選擇任務。",
      backTo: BACK_TO,
      backLabel: BACK_LABEL,
    });

    const region = screen.getByRole("region", { name: "尚未選擇任務" });
    expect(
      descriptionWithText(region, "未指定任務，請回到儀表板重新選擇任務。"),
    ).toBeInTheDocument();
    expect(region.querySelector("bdi")).toBeNull();
    expect(within(region).getAllByRole("link")).toHaveLength(1);
    expect(within(region).getByRole("link")).toHaveAccessibleName(BACK_LABEL);
  });

  it("shows a 300-character identifier in full", () => {
    const longIdentifier = "a1-".repeat(100);
    renderScreen(notFoundProps(longIdentifier));

    const region = screen.getByRole("region", { name: NOT_FOUND_TITLE });
    const identifier = region.querySelector("bdi");
    expect(longIdentifier).toHaveLength(300);
    expect(identifier?.textContent).toBe(longIdentifier);
    expect(identifier).toHaveClass("[overflow-wrap:anywhere]");
  });

  it("shows markup and a right-to-left override in an identifier as isolated plain text", () => {
    const strange = "<img src=x onerror=alert(1)>\u202Eabc";
    renderScreen(notFoundProps(strange));

    const region = screen.getByRole("region", { name: NOT_FOUND_TITLE });
    expect(document.querySelector("img")).toBeNull();
    const identifier = region.querySelector("bdi");
    expect(identifier?.textContent).toBe(strange);
    expect(identifier?.children).toHaveLength(0);
    // The text after the identifier sits outside the isolate, so the override
    // cannot flip the rest of the sentence.
    expect(identifier?.nextSibling?.textContent).toBe(
      " 不存在，請確認網址或回到儀表板重新選擇任務。",
    );
    expect(
      descriptionWithText(
        region,
        `任務代碼 ${strange} 不存在，請確認網址或回到儀表板重新選擇任務。`,
      ),
    ).toBeInTheDocument();
  });

  it("has the same structure for both kinds with no session, query client or auth provider", () => {
    const { unmount } = renderScreen(notFoundProps());
    const notFound = structureOf(screen.getByRole("region", { name: NOT_FOUND_TITLE }));
    unmount();
    renderScreen(deniedProps());
    const denied = structureOf(screen.getByRole("region", { name: DENIED_TITLE }));

    expect(notFound).toEqual({ headings: 1, paragraphs: 1, links: 1, buttons: 0 });
    expect(denied).toEqual(notFound);
  });

  it("moves focus to the title on arrival, and one Tab reaches the way back", async () => {
    const user = userEvent.setup();
    renderScreen(notFoundProps());

    expect(screen.getByRole("heading", { name: NOT_FOUND_TITLE })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: BACK_LABEL })).toHaveFocus();
  });

  it("leaves focus where it was when focusOnMount is false", () => {
    renderScreen({ ...notFoundProps(), focusOnMount: false });

    expect(screen.getByRole("heading", { name: NOT_FOUND_TITLE })).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it("uses a level-one heading by default and a level-two heading when asked", () => {
    const { unmount } = renderScreen(notFoundProps());
    expect(screen.getByRole("heading", { level: 1, name: NOT_FOUND_TITLE })).toBeInTheDocument();
    unmount();

    renderScreen({ ...notFoundProps(), headingLevel: 2 });
    expect(screen.getByRole("heading", { level: 2, name: NOT_FOUND_TITLE })).toBeInTheDocument();
  });

  it("does not announce itself as an alert", () => {
    renderScreen(deniedProps());

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelector("[aria-live]")).toBeNull();
  });
});

/** Counts the controls and text blocks a screen is built from. */
function structureOf(region: HTMLElement) {
  return {
    headings: within(region).getAllByRole("heading").length,
    paragraphs: region.querySelectorAll("p").length,
    links: within(region).getAllByRole("link").length,
    buttons: within(region).queryAllByRole("button").length,
  };
}
