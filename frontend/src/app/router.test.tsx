/**
 * The app router (login-auth-guard ui-design §頁面與路由, §元件樹 › 守門; specs
 * auth-guard and frontend-routing). Every test builds its own QueryClient, so
 * the shared "current session" query starts empty, as on a fresh page load.
 */
import type { QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readRouteDeclaration } from "@/features/app-shell";
import { LANGUAGE_STORAGE_KEY, i18n, readStoredLanguage } from "@/lib/i18n";
import { HEALTH_URL, errorBody, healthOkHandler } from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";
import {
  CURRENT_SESSION_URL,
  SESSIONS_URL,
  SESSION_REFRESH_URL,
  SPEC_MEMBER,
  accountErrorResponse,
  authOptionsHandler,
  sessionBody,
  sessionCreatedResponse,
  signedInHandler,
  signedOutHandlers,
  type AccountErrorCode,
} from "@/test/session-fixtures";

import { App } from "./app";
import { AppRoot } from "./app-root";
import { AppShellLayout } from "./app-shell-layout";
import { createQueryClient } from "./query-client";
import { createAppRouter, type AppRouter } from "./router";

let seen: string[] = [];
let router: AppRouter | undefined;

/** Puts the browser at `path`, then builds the router and renders the app with a fresh cache. */
function openAt(path: string, client: QueryClient = createQueryClient()): AppRouter {
  window.history.replaceState(null, "", path);
  router = createAppRouter();
  render(<App router={router} queryClient={client} />);
  return router;
}

/** Waits until the router shows `pathname`. */
async function expectPath(current: AppRouter, pathname: string): Promise<void> {
  await waitFor(() => {
    expect(current.state.location.pathname).toBe(pathname);
  });
}

/** How many requests MSW saw for `target` (`GET http://...`). */
function countOf(target: string): number {
  return seen.filter((request) => request === target).length;
}

/** The current-session query fails with `code`, and so does the refresh with `refreshCode`. */
function refusedWith(refreshCode: AccountErrorCode): void {
  server.use(
    http.get(CURRENT_SESSION_URL, () => accountErrorResponse("AUTH_REQUIRED", 401)),
    http.post(SESSION_REFRESH_URL, () => accountErrorResponse(refreshCode, 401)),
  );
}

/** Answers `url` with a 503 DATABASE_UNAVAILABLE error envelope. */
function healthDatabaseUnavailableAt(url: string) {
  return http.get(url, () =>
    HttpResponse.json(errorBody({ code: "DATABASE_UNAVAILABLE" }), { status: 503 }),
  );
}

beforeEach(() => {
  seen = [];
  server.events.on("request:start", ({ request }) => {
    seen.push(`${request.method} ${request.url}`);
  });
  server.use(healthOkHandler(), authOptionsHandler());
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

describe("the guard while the session is being checked", () => {
  it("shows no page content until the session query answers", async () => {
    server.use(
      http.get(CURRENT_SESSION_URL, async () => {
        await delay("infinite");
        return HttpResponse.error();
      }),
    );

    openAt("/dashboard/dashboard");
    await waitFor(() => {
      expect(countOf(`GET ${CURRENT_SESSION_URL}`)).toBe(1);
    });

    expect(screen.queryByText("你已登入")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "登入" })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(SPEC_MEMBER.email);
  });
});

describe("signed-out visitors", () => {
  beforeEach(() => {
    server.use(...signedOutHandlers());
  });

  it("are sent from the landing page to the sign-in page without keeping history", async () => {
    const before = window.history.length;

    const current = openAt("/dashboard/dashboard");

    await expectPath(current, "/account/login");
    expect(await screen.findByRole("region", { name: "登入" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(window.history.length).toBe(before);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("are sent from / to the sign-in page", async () => {
    const current = openAt("/");

    await expectPath(current, "/account/login");
    expect(await screen.findByRole("region", { name: "登入" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("are sent from an unknown path through / to the sign-in page", async () => {
    const before = window.history.length;

    const current = openAt("/no-such-page");

    await expectPath(current, "/account/login");
    expect(window.history.length).toBe(before);
    expect(await screen.findByRole("region", { name: "登入" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("are sent quietly from a cancelled Google callback to the sign-in page", async () => {
    const before = window.history.length;

    const current = openAt("/account/google/callback?error=access_denied");

    await expectPath(current, "/account/login");
    expect(window.location.search).toBe("");
    expect(window.history.length).toBe(before);
    expect(await screen.findByRole("region", { name: "登入" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("go to the landing page after signing in, wherever they started", async () => {
    const user = userEvent.setup();
    let signedIn = false;
    server.use(
      http.post(SESSIONS_URL, () => {
        signedIn = true;
        return sessionCreatedResponse(SPEC_MEMBER);
      }),
      http.get(CURRENT_SESSION_URL, () =>
        signedIn
          ? HttpResponse.json(sessionBody(SPEC_MEMBER))
          : accountErrorResponse("AUTH_REQUIRED", 401),
      ),
    );
    const current = openAt("/dashboard/dashboard");
    await expectPath(current, "/account/login");

    await user.type(await screen.findByLabelText("電子郵件"), "user@example.com");
    await user.type(screen.getByLabelText("密碼"), "any-phrase");
    await user.click(screen.getByRole("button", { name: "登入" }));

    await expectPath(current, "/dashboard/dashboard");
    expect(await screen.findByRole("heading", { name: "你已登入" })).toBeInTheDocument();
  });
});

describe("signed-in visitors", () => {
  beforeEach(() => {
    server.use(signedInHandler(SPEC_MEMBER));
  });

  it("are sent from the sign-in page to the landing page with one session query", async () => {
    const before = window.history.length;

    const current = openAt("/account/login");

    await expectPath(current, "/dashboard/dashboard");
    expect(await screen.findByRole("heading", { name: "你已登入" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "登入" })).not.toBeInTheDocument();
    expect(window.history.length).toBe(before);
    expect(countOf(`GET ${CURRENT_SESSION_URL}`)).toBe(1);
  });

  it("are sent from the Google callback to the landing page", async () => {
    const current = openAt("/account/google/callback?code=abc&state=xyz");

    await expectPath(current, "/dashboard/dashboard");
  });

  it("are sent from / to the landing page", async () => {
    const current = openAt("/");

    await expectPath(current, "/dashboard/dashboard");
    expect(await screen.findByText("王小明（user@example.com）")).toBeInTheDocument();
  });
});

describe("a failing session check counts as signed out", () => {
  it("shows the no-response sentence after a 503", async () => {
    server.use(healthDatabaseUnavailableAt(CURRENT_SESSION_URL));

    const current = openAt("/dashboard/dashboard");

    await expectPath(current, "/account/login");
    expect(await screen.findByRole("alert")).toHaveTextContent("平台暫時沒有回應，請稍後再試。");
  });

  it("shows the no-response sentence when the connection fails", async () => {
    server.use(http.get(CURRENT_SESSION_URL, () => HttpResponse.error()));

    const current = openAt("/");

    await expectPath(current, "/account/login");
    expect(await screen.findByRole("alert")).toHaveTextContent("平台暫時沒有回應，請稍後再試。");
  });
});

describe("passive sign-out", () => {
  it("shows the expired sentence when the refresh says the session expired", async () => {
    refusedWith("ACCOUNT_SESSION_EXPIRED");

    const current = openAt("/dashboard/dashboard");

    await expectPath(current, "/account/login");
    expect(await screen.findByRole("alert")).toHaveTextContent("登入已過期，請重新登入");
    expect(window.location.search).toBe("");
  });

  it.each([
    ["ACCOUNT_SESSION_EXPIRED", "Session expired, please sign in again"],
    ["ACCOUNT_SESSION_INVALID", "Authentication failed, please sign in"],
  ] as const)("shows the English sentence for %s", async (code, sentence) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    await i18n.changeLanguage(readStoredLanguage());
    refusedWith(code);

    openAt("/dashboard/dashboard");

    expect(await screen.findByRole("alert")).toHaveTextContent(sentence);
  });

  it("shows the sentence once, not again when the sign-in page is reopened", async () => {
    const user = userEvent.setup();
    refusedWith("ACCOUNT_SESSION_EXPIRED");
    const current = openAt("/dashboard/dashboard");
    expect(await screen.findByRole("alert")).toHaveTextContent("登入已過期，請重新登入");

    // Registration is not registered yet, so the link comes back through / (U7).
    await user.click(await screen.findByRole("link", { name: "前往註冊" }));

    await expectPath(current, "/account/login");
    expect(await screen.findByRole("region", { name: "登入" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows no banner when the refresh finds no session either", async () => {
    refusedWith("AUTH_REQUIRED");

    const current = openAt("/dashboard/dashboard");

    await expectPath(current, "/account/login");
    expect(await screen.findByRole("region", { name: "登入" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show the sentence again after a reload", async () => {
    refusedWith("ACCOUNT_SESSION_INVALID");
    const first = openAt("/dashboard/dashboard");
    await expectPath(first, "/account/login");
    expect(await screen.findByRole("alert")).toHaveTextContent("驗證失敗，請重新登入");

    // A reload: the backend cleared the cookies, the page starts again.
    first.dispose();
    router = undefined;
    refusedWith("AUTH_REQUIRED");
    document.body.innerHTML = "";
    const second = createAppRouter();
    router = second;
    render(<App router={second} queryClient={createQueryClient()} />);

    expect(await screen.findByRole("region", { name: "登入" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("browser titles", () => {
  it("names the sign-in page and follows the language", async () => {
    server.use(...signedOutHandlers());
    const user = userEvent.setup();

    openAt("/account/login");

    await waitFor(() => {
      expect(document.title).toBe("Label Suite — 登入");
    });
    await user.click(screen.getByRole("button", { name: /ZH/ }));
    await waitFor(() => {
      expect(document.title).toBe("Label Suite — Sign In");
    });
  });

  it("names the landing page", async () => {
    server.use(signedInHandler(SPEC_MEMBER));

    openAt("/dashboard/dashboard");

    await waitFor(() => {
      expect(document.title).toBe("Label Suite — 你已登入");
    });
  });
});

describe("createAppRouter in development mode", () => {
  beforeEach(() => {
    server.use(...signedOutHandlers());
  });

  it("opens the health page without signing in and keeps its URL", async () => {
    const current = openAt("/dev/health");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("系統健康檢查");
    expect(current.state.location.pathname).toBe("/dev/health");
    expect(countOf(`GET ${CURRENT_SESSION_URL}`)).toBe(0);
  });

  it("opens the component gallery directly and keeps its URL", async () => {
    const current = openAt("/dev/gallery");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("元件展示");
    expect(current.state.location.pathname).toBe("/dev/gallery");
  });

  it("sends / to the sign-in page, not to the health page", async () => {
    const current = openAt("/");

    await expectPath(current, "/account/login");
    expect(countOf(`GET ${HEALTH_URL}`)).toBe(0);
  });

  it("offers no language switch on either developer page", async () => {
    const current = openAt("/dev/health");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("系統健康檢查");
    expectNoLanguageSwitch();

    await act(async () => {
      await current.navigate("/dev/gallery");
    });
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("元件展示");
    expectNoLanguageSwitch();
  });

  it("離開展示頁不還原外觀: stays dark on the health page, which has no switch", async () => {
    const user = userEvent.setup();
    const current = openAt("/dev/gallery");
    await user.click(await screen.findByRole("button", { name: "切換為深色模式" }));
    expect(document.documentElement.dataset.theme).toBe("dark");

    await act(async () => {
      await current.navigate("/dev/health");
    });

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("系統健康檢查");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.queryByRole("button", { name: /切換為(深|淺)色模式/ })).toBeNull();
  });
});

describe("createAppRouter in a production build", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false);
    server.use(...signedOutHandlers());
  });

  it("sends / to the sign-in page after one session query", async () => {
    const current = openAt("/");

    await expectPath(current, "/account/login");
    expect(await screen.findByRole("region", { name: "登入" })).toBeInTheDocument();
    expect(countOf(`GET ${CURRENT_SESSION_URL}`)).toBe(1);
    expect(countOf(`GET ${HEALTH_URL}`)).toBe(0);
  });

  it.each(["/dev/health", "/dev/gallery"])("does not register %s", async (path) => {
    const current = openAt(path);

    await expectPath(current, "/account/login");
    expect(screen.queryByText("系統健康檢查")).not.toBeInTheDocument();
    expect(screen.queryByText("元件展示")).not.toBeInTheDocument();
    expect(countOf(`GET ${HEALTH_URL}`)).toBe(0);
  });
});

/** Asserts the page has no control that could change the interface language. */
function expectNoLanguageSwitch(): void {
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  const languageName = /語言|language|english|中文|繁體|zh-TW|\ben\b|^ZH|^EN/i;
  for (const role of ["button", "link", "radio", "switch", "menuitem", "tab"] as const) {
    expect(screen.queryAllByRole(role, { name: languageName })).toEqual([]);
  }
}

/** The parts of a route the declaration check reads. */
interface RouteNode {
  /** The route's path, when it has one. */
  path?: string;
  /** What it draws. */
  element?: ReactNode;
  /** Its declaration for the shell. */
  handle?: unknown;
  /** Child routes. */
  children?: RouteNode[];
}

function drawsShell(route: RouteNode): boolean {
  return isValidElement(route.element) && route.element.type === AppShellLayout;
}

/** A declaration the shell can read: the same check AppShellLayout uses, so a typo fails here. */
function declaresNavKey(handle: unknown): boolean {
  return readRouteDeclaration([handle]) !== null;
}

/**
 * Every route with an element under the shell layout that declares no known
 * `navKey`, named by its path (clarification P3): no default fills the gap.
 */
function routesMissingNavKey(routes: readonly RouteNode[], insideShell = false): string[] {
  return routes.flatMap((route) => {
    const inside = insideShell || drawsShell(route);
    const own =
      insideShell && route.element !== undefined && !declaresNavKey(route.handle)
        ? [route.path ?? "(no path)"]
        : [];
    return [...own, ...routesMissingNavKey(route.children ?? [], inside)];
  });
}

describe("the shell's routes (sidebar-nav design D4, clarification P3)", () => {
  it("wraps every route, developer pages and * included, in AppRoot", () => {
    const current = createAppRouter();
    router = current;

    const routes: readonly RouteNode[] = current.routes;
    expect(routes).toHaveLength(1);
    const [root] = routes;
    expect(root?.path).toBeUndefined();
    expect(isValidElement(root?.element) && root.element.type === AppRoot).toBe(true);
    const paths = (root?.children ?? []).map((route) => route.path);
    expect(paths).toEqual(expect.arrayContaining(["/dev/health", "/dev/gallery", "/", "*"]));
  });

  it("has a navKey on every route with an element under the shell, and the landing page is one", () => {
    const current = createAppRouter();
    router = current;

    const routes: readonly RouteNode[] = current.routes;
    expect(routesMissingNavKey(routes)).toEqual([]);
    const shell = routes
      .flatMap((route) => route.children ?? [])
      .flatMap((route) => route.children ?? [])
      .find(drawsShell);
    expect(shell?.children?.map((route) => [route.path, route.handle])).toEqual([
      ["/dashboard/dashboard", { navKey: "dashboard" }],
    ]);
  });

  it("fails and names the path when a route under the shell declares no navKey", () => {
    const tree: RouteNode[] = [
      {
        element: <AppShellLayout />,
        children: [
          { path: "/dashboard/dashboard", element: <p />, handle: { navKey: "dashboard" } },
          { path: "/task-management/task-list", element: <p /> },
          { path: "/account/profile", element: <p />, handle: { title: "x" } },
        ],
      },
      { path: "/account/login", element: <p /> },
    ];

    expect(routesMissingNavKey(tree)).toEqual(["/task-management/task-list", "/account/profile"]);
  });

  it("fails on a navKey the shell does not know, such as a typo", () => {
    const tree: RouteNode[] = [
      {
        element: <AppShellLayout />,
        children: [
          { path: "/dashboard/dashboard", element: <p />, handle: { navKey: "dashbaord" } },
          { path: "/account/profile", element: <p />, handle: { navKey: 3 } },
        ],
      },
    ];

    expect(routesMissingNavKey(tree)).toEqual(["/dashboard/dashboard", "/account/profile"]);
  });
});
