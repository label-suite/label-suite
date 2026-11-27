/**
 * The gallery's table of contents and browser title (ui-design.md §元件樹,
 * §文案, clarification Q19 UI-6), and the page's promise to make no request.
 * The narrow-window layout (nav above the content) is checked by hand at
 * acceptance; jsdom has no layout.
 */
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { server } from "@/test/msw-server";

import { renderGallery } from "./render-gallery.test-helper";

const LINKS = [
  ["Button", "#button"],
  ["Input", "#input"],
  ["Label", "#label"],
  ["Badge", "#badge"],
  ["Alert", "#alert"],
  ["Card", "#card"],
  ["Separator", "#separator"],
  ["Dialog", "#dialog"],
  ["Skeleton · Empty", "#states"],
  ["無權限與找不到", "#blocked"],
  ["Token 對照", "#tokens"],
] as const;

let requests: string[] = [];

/** Opens the gallery at `url`, as if the developer typed it. */
function openAt(url: string) {
  window.history.replaceState(null, "", url);
  return renderGallery();
}

function navLinks(): HTMLElement[] {
  return within(screen.getByRole("navigation", { name: "元件目錄" })).getAllByRole("link");
}

function currentLinks(): (string | null)[] {
  return navLinks()
    .filter((link) => link.hasAttribute("aria-current"))
    .map((link) => link.textContent);
}

beforeEach(() => {
  requests = [];
  server.events.on("request:start", ({ request }) => {
    requests.push(`${request.method} ${request.url}`);
  });
});

afterEach(() => {
  server.events.removeAllListeners();
  window.history.replaceState(null, "", "/");
  document.title = "";
  delete document.documentElement.dataset.theme;
});

describe("gallery nav", () => {
  it("is a nav named 元件目錄 with the eyebrow and eleven section links", () => {
    openAt("/dev/gallery");

    const nav = screen.getByRole("navigation", { name: "元件目錄" });
    expect(within(nav).getByText("DEV ONLY · /dev/gallery")).toBeInTheDocument();
    expect(navLinks().map((link) => [link.textContent, link.getAttribute("href")])).toEqual(
      LINKS.map(([name, href]) => [name, href]),
    );
    for (const [, href] of LINKS) {
      expect(document.getElementById(href.slice(1))?.tagName).toBe("SECTION");
    }
  });

  it("marks only the link of the URL's anchor as current", () => {
    openAt("/dev/gallery#badge");

    expect(screen.getByRole("link", { name: "Badge" })).toHaveAttribute("aria-current");
    expect(currentLinks()).toEqual(["Badge"]);
    expect(navLinks()).toHaveLength(11);
  });

  it("marks the 無權限與找不到 link at #blocked, and it points at the section of that name", () => {
    openAt("/dev/gallery#blocked");

    expect(navLinks()).toHaveLength(11);
    expect(currentLinks()).toEqual(["無權限與找不到"]);
    const target = document.getElementById("blocked");
    expect(target?.tagName).toBe("SECTION");
    expect(screen.getByRole("region", { name: "無權限與找不到" })).toBe(target);
  });

  it("marks no link without an anchor", () => {
    openAt("/dev/gallery");

    expect(currentLinks()).toEqual([]);
  });

  it("follows the anchor when it changes", () => {
    openAt("/dev/gallery#badge");

    act(() => {
      window.history.replaceState(null, "", "/dev/gallery#card");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(currentLinks()).toEqual(["Card"]);
  });

  it("sets the browser title to Label Suite — 元件展示", () => {
    openAt("/dev/gallery");

    expect(document.title).toBe("Label Suite — 元件展示");
  });

  it("sends no request while moving between sections and switching themes", async () => {
    const user = userEvent.setup();
    openAt("/dev/gallery");

    for (const [name] of LINKS) {
      await user.click(screen.getByRole("link", { name }));
    }
    await user.click(screen.getByRole("button", { name: "切換為深色模式" }));
    await user.click(screen.getByRole("button", { name: "切換為淺色模式" }));

    expect(window.location.hash).toBe("#tokens");
    expect(requests).toEqual([]);
  });
});
