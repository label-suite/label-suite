/**
 * The signed-in shell, assembled (sidebar-nav tasks 3.2, 3.4; design D5, D6,
 * D8, D11). Every test runs the real createAppRouter() tree inside
 * <StrictMode>, as src/main.tsx does, and counts the "current session"
 * queries the backend answers.
 *
 * Nothing under /task-management exists yet, so clicking Task Management
 * walks the real redirect chain: /task-management/task-list → `*` → `/` →
 * /dashboard/dashboard. The shell unmounts and mounts again on the way; D6
 * makes that arrival, and only that kind of arrival, refetch the session.
 */
import type { QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SessionUserData } from "@/api/generated/label-suite.schemas";
import { errorBody } from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";
import {
  CURRENT_SESSION_URL,
  SAMPLE_ADMIN,
  SESSIONS_URL,
  SPEC_MEMBER,
  accountErrorResponse,
  authOptionsHandler,
  sessionBody,
  sessionCreatedResponse,
} from "@/test/session-fixtures";

import { App } from "./app";
import { createQueryClient } from "./query-client";
import { createAppRouter, type AppRouter } from "./router";

const LANDING = "/dashboard/dashboard";
const BLOCKED_ANNOTATION = "你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。";

let router: AppRouter | undefined;
/** The account the session endpoint answers with; null answers 401. */
let account: SessionUserData | null = SPEC_MEMBER;
/** When set, the session endpoint answers with this response instead. */
let override: (() => Response) | null = null;
/** How many session queries the backend answered. */
let answered = 0;

/** Puts the browser at `path` and renders the app in StrictMode with a fresh cache. */
function openAt(path: string, client: QueryClient = createQueryClient()): AppRouter {
  window.history.replaceState(null, "", path);
  router = createAppRouter();
  render(
    <StrictMode>
      <App router={router} queryClient={client} />
    </StrictMode>,
  );
  return router;
}

async function expectPath(current: AppRouter, pathname: string): Promise<void> {
  await waitFor(() => {
    expect(current.state.location.pathname).toBe(pathname);
  });
}

/** The names of the main navigation's items, in order. */
function navNames(): string[] {
  const nav = screen.getByRole("navigation", { name: "主導覽" });
  return Array.from(nav.querySelectorAll("a, button")).map((element) => element.textContent);
}

/** Opens the landing page and waits for the sidebar. */
async function openLanding(path = LANDING): Promise<AppRouter> {
  const current = openAt(path);
  await expectPath(current, LANDING);
  await screen.findByRole("navigation", { name: "主導覽" });
  return current;
}

/** Clicks Task Management and waits until the redirect chain is back on the landing page. */
async function walkRedirectChain(current: AppRouter): Promise<void> {
  const user = userEvent.setup();
  const seen: string[] = [];
  const unsubscribe = current.subscribe((state) => {
    seen.push(state.location.pathname);
  });
  await user.click(screen.getByRole("link", { name: "任務管理" }));
  await waitFor(() => {
    expect(seen).toContain("/task-management/task-list");
    expect(current.state.location.pathname).not.toBe("/task-management/task-list");
    expect(current.state.location.pathname).not.toBe("/");
  });
  unsubscribe();
}

beforeEach(() => {
  account = SPEC_MEMBER;
  override = null;
  answered = 0;
  server.use(
    authOptionsHandler(),
    http.get(CURRENT_SESSION_URL, () => {
      answered += 1;
      if (override !== null) {
        return override();
      }
      return account === null
        ? accountErrorResponse("AUTH_REQUIRED", 401)
        : HttpResponse.json(sessionBody(account));
    }),
  );
});

afterEach(() => {
  router?.dispose();
  router = undefined;
  document.title = "";
  window.history.replaceState(null, "", "/");
});

describe("one session query per page load (auth-guard 「兩種路由共用同一次查詢」)", () => {
  it("opening the landing page directly asks once and draws the shell", async () => {
    await openLanding();

    expect(navNames()).toEqual(["儀表板", "任務管理", "標記作業", "資料集分析", "個人設定"]);
    expect(answered).toBe(1);
  });

  it("a signed-in visitor sent from /account/login to the landing page is asked once", async () => {
    await openLanding("/account/login");

    expect(answered).toBe(1);
  });
});

describe("the temporary landing page in the shell (auth-guard 「暫時落點顯示目前登入者」)", () => {
  it("平台成員看到自己的身分: the card has no sign-out, the sidebar has it", async () => {
    await openLanding();

    const card = await screen.findByRole("region", { name: "你已登入" });
    expect(within(card).getByText("王小明（user@example.com）")).toBeInTheDocument();
    expect(within(card).getByText("平台成員")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "登出" })).toBeNull();
    const sidebar = screen.getByRole("banner");
    expect(within(sidebar).getByRole("button", { name: "登出" })).toBeInTheDocument();
    expect(within(sidebar).getByText("王小明")).toBeInTheDocument();
    expect(within(sidebar).getByTestId("role-indicator")).toHaveTextContent("一般使用者");
    expect(within(sidebar).queryByText("平台成員")).toBeNull();
    expect(screen.getByRole("link", { name: "儀表板" })).toHaveAttribute("aria-current", "page");
    expect(document.title).toBe("Label Suite — 你已登入");
  });

  it("系統管理員看到系統管理員: the card shows the system role, the sidebar six items", async () => {
    account = SAMPLE_ADMIN;
    await openLanding();

    expect(await screen.findByText("系統管理員")).toBeInTheDocument();
    expect(navNames()).toEqual([
      "儀表板",
      "任務管理",
      "標記作業",
      "資料集分析",
      "系統管理",
      "個人設定",
    ]);
  });
});

describe("refetching the session on the next page (design D6, clarification Q11)", () => {
  it("角色被改掉時側欄不立刻變: focus does not refetch; the next page does, once", async () => {
    account = SAMPLE_ADMIN;
    const current = await openLanding();
    expect(navNames()).toHaveLength(6);

    account = { ...SAMPLE_ADMIN, role: "user" };
    act(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(answered).toBe(1);
    expect(navNames()).toHaveLength(6);

    await walkRedirectChain(current);

    await expectPath(current, LANDING);
    await waitFor(() => {
      expect(navNames()).toHaveLength(5);
    });
    expect(answered).toBe(2);
    expect(screen.queryByRole("button", { name: "系統管理" })).toBeNull();
  });

  it("錯誤訊息不出現系統內部資訊: a 500 on the next page signs out with the plain sentence", async () => {
    const current = await openLanding();

    override = () =>
      HttpResponse.json(errorBody({ code: "INTERNAL_ERROR", traceId: "trace-abc" }), {
        status: 500,
      });
    await walkRedirectChain(current);

    await expectPath(current, "/account/login");
    expect(await screen.findByRole("alert")).toHaveTextContent("平台暫時沒有回應，請稍後再試。");
    const text = document.body.textContent;
    expect(text).not.toContain("INTERNAL_ERROR");
    expect(text).not.toContain("trace-abc");
    expect(text).not.toContain("/api/v1/current-session");
  });

  it("clicking the blocked item after the redirect chain sends no further query", async () => {
    const user = userEvent.setup();
    const current = await openLanding();
    await walkRedirectChain(current);
    await expectPath(current, LANDING);
    await waitFor(() => {
      expect(answered).toBe(2);
    });

    await user.click(screen.getByRole("link", { name: "標記作業" }));
    expect(await screen.findByText(BLOCKED_ANNOTATION)).toBeInTheDocument();
    await waitFor(() => {
      expect(current.state.location.state).toBeNull();
    });

    expect(answered).toBe(2);
  });

  it("clicking the blocked item after arriving from /account/login sends no further query", async () => {
    const user = userEvent.setup();
    const current = await openLanding("/account/login");

    await user.click(screen.getByRole("link", { name: "標記作業" }));
    expect(await screen.findByText(BLOCKED_ANNOTATION)).toBeInTheDocument();
    await waitFor(() => {
      expect(current.state.location.state).toBeNull();
    });

    expect(answered).toBe(1);
  });
});

describe("blocking (07-01 §進入模組的條件; design D5)", () => {
  it("沒有任務角色時點擊標記作業: back on the landing page with the explanation, once", async () => {
    const user = userEvent.setup();
    const current = await openLanding();
    const link = screen.getByRole("link", { name: "標記作業" });
    expect(link).toHaveAttribute("href", "/annotation/annotation-list?entry=nav");
    expect(link.getAttribute("href")).not.toMatch(/task_type|task_id/);

    await user.click(link);

    expect(await screen.findByRole("alert")).toHaveTextContent(BLOCKED_ANNOTATION);
    expect(current.state.location.pathname).toBe(LANDING);
    expect(current.state.location.search).toBe("");
    expect(current.state.historyAction).toBe("REPLACE");
    expect(answered).toBe(1);
  });

  it("leaves a Ctrl-click to the browser: no redirect and no explanation", async () => {
    const user = userEvent.setup();
    const current = await openLanding();
    const before = current.state.location.key;
    let leftToBrowser = false;
    // After the app has handled the click: record whether it left the default
    // (opening a tab) alone, then stop it, since jsdom cannot open tabs.
    const recordDefault = (event: MouseEvent) => {
      leftToBrowser = !event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener("click", recordDefault);

    await user.keyboard("{Control>}");
    await user.click(screen.getByRole("link", { name: "標記作業" }));
    await user.keyboard("{/Control}");
    window.removeEventListener("click", recordDefault);

    expect(leftToBrowser).toBe(true);
    expect(current.state.location.key).toBe(before);
    expect(screen.queryByText(BLOCKED_ANNOTATION)).toBeNull();
  });
});

describe("collapsing (07-01 §側欄收合; design D8)", () => {
  it("點擊側欄空白區收合: a click on the empty space collapses and is remembered", async () => {
    const user = userEvent.setup();
    await openLanding();

    await user.click(screen.getByRole("banner"));

    expect(screen.getByRole("button", { name: "展開側欄" })).toBeInTheDocument();
    expect(window.localStorage.getItem("labelsuite.sidebarCollapsed")).toBe("true");
  });

  it("點擊導覽連結不會收合", async () => {
    const user = userEvent.setup();
    await openLanding();

    await user.click(screen.getByRole("link", { name: "儀表板" }));

    expect(screen.getByRole("button", { name: "收合側欄" })).toBeInTheDocument();
  });

  it("點擊登出不會收合: signed out, signed in again, still expanded", async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(CURRENT_SESSION_URL, () => {
        account = null;
        return new HttpResponse(null, { status: 204 });
      }),
      http.post(SESSIONS_URL, () => {
        account = SPEC_MEMBER;
        return sessionCreatedResponse(SPEC_MEMBER);
      }),
    );
    const current = await openLanding();

    await user.click(screen.getByRole("button", { name: "登出" }));
    await expectPath(current, "/account/login");
    await user.type(await screen.findByLabelText("電子郵件"), "user@example.com");
    await user.type(screen.getByLabelText("密碼"), "any-phrase");
    await user.click(screen.getByRole("button", { name: "登入" }));
    await expectPath(current, LANDING);

    expect(await screen.findByRole("button", { name: "收合側欄" })).toBeInTheDocument();
    expect(window.localStorage.getItem("labelsuite.sidebarCollapsed")).not.toBe("true");
  });
});

describe("the shortcut overview's key (07-01 §快捷鍵總覽; design D12)", () => {
  it("桌機開啟快捷鍵總覽: ? opens it with the Global group, Esc closes it", async () => {
    const user = userEvent.setup();
    await openLanding();
    const dashboard = screen.getByRole("link", { name: "儀表板" });
    dashboard.focus();

    await user.keyboard("?");
    const dialog = await screen.findByRole("dialog", { name: "目前頁面可用快捷鍵" });
    expect(
      within(dialog)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["全域"]);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(dashboard).toHaveFocus();
  });
});
