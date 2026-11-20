/**
 * The app router (design D6, clarification Q1, Q14): the two developer pages
 * exist only in development mode, `/` and unknown paths redirect to
 * /dev/health with a history replace, and a production build is an empty shell.
 * The language comes from src/test/setup.ts (zh-TW, `common` only); the page
 * namespaces are registered by the lazy routes' entry modules.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HEALTH_URL, healthOkHandler } from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";

import { App } from "./app";
import { createAppRouter, type AppRouter } from "./router";

/** Every request MSW saw: method, URL and the Accept-Language header. */
interface SeenRequest {
  /** `GET http://...` */
  target: string;
  /** The Accept-Language header. */
  acceptLanguage: string | null;
}

let seen: SeenRequest[] = [];
let router: AppRouter | undefined;

/** Puts the browser at `path`, then builds the app router and renders the app. */
function openAt(path: string): AppRouter {
  window.history.replaceState(null, "", path);
  router = createAppRouter();
  render(<App router={router} />);
  return router;
}

/** Resolves once the router has matched its first location. */
async function settled(current: AppRouter): Promise<void> {
  await waitFor(() => {
    expect(current.state.initialized).toBe(true);
    expect(current.state.navigation.state).toBe("idle");
  });
}

beforeEach(() => {
  seen = [];
  server.events.on("request:start", ({ request }) => {
    seen.push({
      target: `${request.method} ${request.url}`,
      acceptLanguage: request.headers.get("Accept-Language"),
    });
  });
  server.use(healthOkHandler());
});

afterEach(() => {
  server.events.removeAllListeners();
  router?.dispose();
  router = undefined;
  vi.unstubAllEnvs();
  delete document.documentElement.dataset.theme;
  document.title = "";
  window.history.replaceState(null, "", "/");
});

describe("createAppRouter in development mode", () => {
  it("redirects / to the health page without keeping / in the history", async () => {
    const before = window.history.length;

    const current = openAt("/");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("系統健康檢查");
    expect(current.state.location.pathname).toBe("/dev/health");
    expect(window.location.pathname).toBe("/dev/health");
    expect(window.history.length).toBe(before);
  });

  it("redirects an unknown path to the health page", async () => {
    const current = openAt("/no-such-page");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("系統健康檢查");
    expect(current.state.location.pathname).toBe("/dev/health");
  });

  it("opens the component gallery directly and keeps its URL", async () => {
    const current = openAt("/dev/gallery");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("元件展示");
    expect(current.state.location.pathname).toBe("/dev/gallery");
  });

  it("shows the health page in the browser's language and asks the backend in it", async () => {
    openAt("/dev/health");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("系統健康檢查");
    expect(await screen.findByText("正常")).toBeInTheDocument();
    expect(seen).toEqual([{ target: `GET ${HEALTH_URL}`, acceptLanguage: "zh-TW" }]);
  });

  it("offers no language switch on either page", async () => {
    const current = openAt("/dev/health");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("系統健康檢查");
    expectNoLanguageSwitch();

    await act(async () => {
      await current.navigate("/dev/gallery");
    });
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("元件展示");
    expectNoLanguageSwitch();
  });

  it("returns to light when leaving the gallery for the health page", async () => {
    const user = userEvent.setup();
    const current = openAt("/dev/gallery");
    await user.click(await screen.findByRole("button", { name: "深色" }));
    expect(document.documentElement.dataset.theme).toBe("dark");

    await act(async () => {
      await current.navigate("/dev/health");
    });

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("系統健康檢查");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("createAppRouter in a production build", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false);
  });

  it("renders an empty shell at / without redirecting or calling the backend", async () => {
    const current = openAt("/");
    await settled(current);

    expect(current.state.location.pathname).toBe("/");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent("");
    expect(seen).toEqual([]);
  });

  it.each(["/dev/health", "/dev/gallery"])("does not register %s", async (path) => {
    const current = openAt(path);
    await settled(current);

    expect(current.state.location.pathname).toBe(path);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent("");
    expect(seen).toEqual([]);
  });
});

/** Asserts the page has no control that could change the interface language. */
function expectNoLanguageSwitch(): void {
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  const languageName = /語言|language|english|中文|繁體|zh-TW|\ben\b/i;
  for (const role of ["button", "link", "radio", "switch", "menuitem", "tab"] as const) {
    expect(screen.queryAllByRole(role, { name: languageName })).toEqual([]);
  }
}
