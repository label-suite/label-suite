/**
 * The dashboard page as a composition (spec dashboard, every Requirement's
 * component part; spec frontend-routing 「每頁設定瀏覽器標題」; design D3, D9;
 * clarification U1, Q11). The task-role source is driven through
 * TaskRoleSourceProvider (design D2) and the session comes from the existing
 * MSW handler, the same query the guards use; the guards themselves are in
 * src/app/router.test.tsx.
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Profiler, useSyncExternalStore, type ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getGetCurrentSessionQueryKey } from "@/api/generated/label-suite";
import type { SessionUserData } from "@/api/generated/label-suite.schemas";
import { createQueryClient } from "@/app/query-client";
import {
  blockedNoticeState,
  NO_TASK_ROLE,
  TaskRoleSourceProvider,
  type TaskRoleSourceState,
} from "@/features/app-shell";
import { changeInterfaceLanguage } from "@/lib/i18n";
import { server } from "@/test/msw-server";
import {
  CURRENT_SESSION_URL,
  SAMPLE_ADMIN,
  SPEC_MEMBER,
  sessionBody,
  signedInHandler,
} from "@/test/session-fixtures";

import { DashboardPage } from "./index";

const LANDING = "/dashboard/dashboard";
const ENTRY_TITLE = "開始你的第一個工作流程";
const STATS_TITLE = "平台使用者統計";
const ERROR_TITLE = "儀表板載入失敗";
const BLOCKED_ANNOTATION = "你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。";
const LOADING: TaskRoleSourceState = { status: "loading" };
const READY: TaskRoleSourceState = { status: "ready", answer: NO_TASK_ROLE };

/** A task-role source the test moves from one state to the next. */
interface ScriptedSource {
  /** The current state. */
  get: () => TaskRoleSourceState;
  /** Moves to `next` and tells every reader. */
  set: (next: TaskRoleSourceState) => void;
  /** Registers a reader; returns its removal. */
  subscribe: (listener: () => void) => () => void;
}

function scriptedSource(initial: TaskRoleSourceState): ScriptedSource {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A failed state whose Retry moves the source to `afterRetry`, as the real source would. */
function failing(source: ScriptedSource, afterRetry: TaskRoleSourceState): TaskRoleSourceState {
  return {
    status: "error",
    retry: () => {
      source.set(afterRetry);
    },
  };
}

/** Props of {@link ScriptedProvider}. */
interface ScriptedProviderProps {
  /** The source whose state is provided. */
  source: ScriptedSource;
  /** The tree that reads it. */
  children: ReactNode;
}

/** Provides the scripted source's current state, re-rendering when it moves. */
function ScriptedProvider({ source, children }: ScriptedProviderProps) {
  const value = useSyncExternalStore(source.subscribe, source.get);
  return <TaskRoleSourceProvider value={value}>{children}</TaskRoleSourceProvider>;
}

let router: ReturnType<typeof createMemoryRouter> | undefined;
let seen: string[] = [];

interface Rendered {
  /** The router the page is in. */
  current: ReturnType<typeof createMemoryRouter>;
  /** The page's query cache. */
  client: QueryClient;
}

/** Renders the page at `entry` for the account the MSW handler answers with. */
async function renderPage(
  source: ScriptedSource,
  { entry = LANDING, onCommit }: { entry?: string; onCommit?: () => void } = {},
): Promise<Rendered> {
  const client = createQueryClient();
  const current = createMemoryRouter(
    [
      { path: LANDING, element: <DashboardPage /> },
      { path: "/account/login", element: <p>Sign-in page</p> },
    ],
    { initialEntries: [entry] },
  );
  router = current;
  render(
    <Profiler id="dashboard" onRender={() => onCommit?.()}>
      <QueryClientProvider client={client}>
        <ScriptedProvider source={source}>
          <RouterProvider router={current} />
        </ScriptedProvider>
      </QueryClientProvider>
    </Profiler>,
  );
  await waitFor(() => {
    expect(client.getQueryData(getGetCurrentSessionQueryKey())).toBeDefined();
  });
  return { current, client };
}

/** The header's h1, failing when it is not there. */
function header(): HTMLElement {
  return screen.getByRole("heading", { level: 1, name: "儀表板" });
}

/** Whether `first` comes before `second` in the document. */
function precedes(first: Element, second: Element): boolean {
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/** Every request MSW saw, as `METHOD pathname`. */
function requests(): string[] {
  return seen.map((request) => {
    const [method, url] = request.split(" ");
    return `${method ?? ""} ${new URL(url ?? "http://x").pathname}`;
  });
}

beforeEach(() => {
  seen = [];
  server.events.on("request:start", ({ request }) => {
    seen.push(`${request.method} ${request.url}`);
  });
  server.use(signedInHandler(SPEC_MEMBER));
});

afterEach(() => {
  server.events.removeAllListeners();
  router?.dispose();
  router = undefined;
  document.title = "";
});

function useAdmin(): void {
  server.use(signedInHandler(SAMPLE_ADMIN));
}

describe("which layout the page draws", () => {
  it("沒有任務角色的人拿到行動入口: a platform member with no task role sees the three cards", async () => {
    await renderPage(scriptedSource(READY));

    const section = await screen.findByRole("region", { name: ENTRY_TITLE });
    expect(within(section).getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByText(STATS_TITLE)).toBeNull();
    expect(screen.queryByTestId("dashboard-skeleton")).toBeNull();
  });

  it.each([
    ["loading", (): TaskRoleSourceState => LOADING],
    ["error", (): TaskRoleSourceState => ({ status: "error", retry: () => undefined })],
  ])(
    "系統管理員不讀任務角色: block A straight away while the source is %s",
    async (_name, state) => {
      useAdmin();
      await renderPage(scriptedSource(state()));

      expect(await screen.findByRole("region", { name: STATS_TITLE })).toBeInTheDocument();
      expect(screen.queryByTestId("dashboard-skeleton")).toBeNull();
      expect(screen.queryByText(ERROR_TITLE)).toBeNull();
      expect(screen.queryByText(ENTRY_TITLE)).toBeNull();
    },
  );

  it("網址參數不能指定版面: ?scenario=admin&view=empty changes nothing", async () => {
    await renderPage(scriptedSource(READY), { entry: `${LANDING}?scenario=admin&view=empty` });

    expect(await screen.findByRole("region", { name: ENTRY_TITLE })).toBeInTheDocument();
    expect(screen.queryByText(STATS_TITLE)).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("角色無效時導向登入頁: draws nothing of its own and only redirects, without signing out", async () => {
    // The generated type forbids an unknown role, so the body is written as plain JSON.
    const body = sessionBody(SPEC_MEMBER);
    server.use(
      http.get(CURRENT_SESSION_URL, () =>
        HttpResponse.json({ ...body, data: { user: { ...SPEC_MEMBER, role: "guest" } } }),
      ),
    );
    const { current } = await renderPage(scriptedSource(READY));

    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
    expect(current.state.location.pathname).toBe("/account/login");
    expect(current.state.historyAction).toBe("REPLACE");
    expect(screen.queryByRole("heading", { name: "儀表板" })).toBeNull();
    expect(requests()).not.toContain(`DELETE /api/v1/current-session`);
  });
});

describe("the header comes first (每一種版面最上方都有同一個頁首)", () => {
  /** The first element the page draws, and what it must precede. */
  function expectHeaderFirst(content: HTMLElement): void {
    const title = header();
    expect(screen.getByText("掌握任務進度與團隊協作狀態")).toBeInTheDocument();
    expect(precedes(title, content)).toBe(true);
    const region = screen.getByRole("region", { name: "儀表板" });
    const page = region.parentElement;
    expect(page?.firstElementChild).toBe(region);
  }

  it("頁首在每一種版面都顯示: member, admin, loading and error", async () => {
    await renderPage(scriptedSource(READY));
    expectHeaderFirst(await screen.findByRole("region", { name: ENTRY_TITLE }));
    router?.dispose();
    document.body.innerHTML = "";

    useAdmin();
    await renderPage(scriptedSource(READY));
    expectHeaderFirst(await screen.findByRole("region", { name: STATS_TITLE }));
    router?.dispose();
    document.body.innerHTML = "";

    server.use(signedInHandler(SPEC_MEMBER));
    await renderPage(scriptedSource(LOADING));
    expectHeaderFirst(await screen.findByTestId("dashboard-skeleton"));
    router?.dispose();
    document.body.innerHTML = "";

    await renderPage(scriptedSource({ status: "error", retry: () => undefined }));
    expectHeaderFirst(await screen.findByRole("alert"));
  });

  it("沒有任務角色時點擊標記作業: the blocked explanation sits after the header, before the layout", async () => {
    await renderPage(scriptedSource(READY), { entry: LANDING });
    await act(async () => {
      await router?.navigate(LANDING, { replace: true, state: blockedNoticeState("annotation") });
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(BLOCKED_ANNOTATION);
    expect(precedes(header(), alert)).toBe(true);
    expect(precedes(alert, screen.getByRole("region", { name: ENTRY_TITLE }))).toBe(true);
    expect(screen.getAllByText(BLOCKED_ANNOTATION)).toHaveLength(1);
  });
});

describe("loading and failing (讀取任務角色時顯示骨架並直接換成版面; 讀取失敗時顯示錯誤與重試)", () => {
  it("讀完無縫換成實際內容: every commit shows the skeleton or the layout, and focus stays put", async () => {
    const source = scriptedSource(LOADING);
    const gaps: number[] = [];
    let commits = 0;
    const { client } = await renderPage(source, {
      onCommit: () => {
        commits += 1;
        const busy = document.querySelector('[data-testid="dashboard-skeleton"]');
        const layout = document.querySelector('[data-testid="user-view"]');
        // Before the session answers there is no page at all; count from the first page.
        if (document.querySelector("h1") !== null && (busy === null) === (layout === null)) {
          gaps.push(commits);
        }
      },
    });
    expect(client.getQueryData(getGetCurrentSessionQueryKey())).toBeDefined();
    const skeleton = await screen.findByRole("region", { name: "載入中" });
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(ENTRY_TITLE)).toBeNull();
    expect(screen.queryByText(ERROR_TITLE)).toBeNull();
    const focused = document.activeElement;

    act(() => {
      source.set(READY);
    });

    expect(await screen.findByRole("region", { name: ENTRY_TITLE })).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-skeleton")).toBeNull();
    expect(gaps).toEqual([]);
    expect(document.activeElement).toBe(focused);
    expect(screen.getByRole("heading", { level: 2, name: ENTRY_TITLE })).not.toHaveFocus();
  });

  it("讀取失敗不改用其他版面 / 讀取失敗不清掉登入狀態", async () => {
    const { current, client } = await renderPage(
      scriptedSource({ status: "error", retry: () => undefined }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ERROR_TITLE);
    expect(screen.queryByTestId("dashboard-skeleton")).toBeNull();
    expect(screen.queryByText(ENTRY_TITLE)).toBeNull();
    expect(screen.queryByText(STATS_TITLE)).toBeNull();
    expect(document.querySelector('[data-slot="metric"]')).toBeNull();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(requests()).not.toContain("DELETE /api/v1/current-session");
    expect(current.state.location.pathname).toBe(LANDING);
    expect(client.getQueryData(getGetCurrentSessionQueryKey())).toEqual({
      kind: "signedIn",
      user: SPEC_MEMBER,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(ERROR_TITLE);
  });

  it("重試後再失敗仍留在錯誤畫面: skeleton with focus on 載入中, then the error with focus on Retry", async () => {
    const user = userEvent.setup();
    const source = scriptedSource(LOADING);
    await renderPage(source);
    act(() => {
      source.set(failing(source, LOADING));
    });
    const retry = await screen.findByRole("button", { name: "重試" });
    expect(retry).not.toHaveFocus();

    retry.focus();
    await user.keyboard("{Enter}");

    const hint = screen.getByText("載入中");
    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重試" })).toBeNull();
    expect(hint).toHaveFocus();

    act(() => {
      source.set(failing(source, LOADING));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(ERROR_TITLE);
    expect(screen.getByRole("button", { name: "重試" })).toHaveFocus();
  });

  it("moves focus to the section title when a retried load succeeds", async () => {
    const user = userEvent.setup();
    const source = scriptedSource(LOADING);
    await renderPage(source);
    act(() => {
      source.set(failing(source, LOADING));
    });
    await user.click(await screen.findByRole("button", { name: "重試" }));
    expect(screen.getByText("載入中")).toHaveFocus();

    act(() => {
      source.set(READY);
    });

    expect(screen.getByRole("heading", { level: 2, name: ENTRY_TITLE })).toHaveFocus();
  });

  it("does not move focus on a later first-time load after a retry has finished", async () => {
    const user = userEvent.setup();
    const source = scriptedSource(LOADING);
    await renderPage(source);
    act(() => {
      source.set(failing(source, LOADING));
    });
    await user.click(await screen.findByRole("button", { name: "重試" }));
    act(() => {
      source.set(READY);
    });
    screen.getByRole("heading", { level: 2, name: ENTRY_TITLE }).blur();

    // The source reloads on its own (no Retry pressed): no focus move this time.
    act(() => {
      source.set(LOADING);
    });
    expect(screen.getByText("載入中")).not.toHaveFocus();
    act(() => {
      source.set(READY);
    });
    expect(screen.getByRole("heading", { level: 2, name: ENTRY_TITLE })).not.toHaveFocus();
  });
});

describe("browser title (每頁設定瀏覽器標題)", () => {
  it.each([
    ["ready", (): TaskRoleSourceState => READY],
    ["loading", (): TaskRoleSourceState => LOADING],
    ["error", (): TaskRoleSourceState => ({ status: "error", retry: () => undefined })],
  ])("儀表板的瀏覽器標題 while %s, in both languages", async (_name, state) => {
    await renderPage(scriptedSource(state()));

    await waitFor(() => {
      expect(document.title).toBe("Label Suite — 儀表板");
    });
    await act(async () => {
      await changeInterfaceLanguage("en");
    });
    expect(document.title).toBe("Label Suite — Dashboard");
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });
});

describe("儀表板碰不到標準答案與測試集", () => {
  const FORBIDDEN = /answer|groundTruth|ground_truth|gold|isTest|is_test|task_id|task_type/i;

  it.each([
    ["a platform member", SPEC_MEMBER],
    ["a system administrator", SAMPLE_ADMIN],
  ] satisfies [string, SessionUserData][])(
    "儀表板不出現標準答案: %s's page sends only the session query",
    async (_name, account) => {
      server.use(signedInHandler(account));
      const { client } = await renderPage(scriptedSource(READY));
      await screen.findByRole("heading", { level: 2 });

      expect(requests()).toEqual(["GET /api/v1/current-session"]);
      const state = client.getQueryData(getGetCurrentSessionQueryKey());
      expect(state).toEqual({ kind: "signedIn", user: account });
      expect(Object.keys(account).sort()).toEqual(["email", "id", "name", "role"]);
      expect(document.body.textContent).not.toMatch(FORBIDDEN);
      for (const link of screen.queryAllByRole("link")) {
        expect(link.getAttribute("href")).not.toMatch(FORBIDDEN);
      }
    },
  );
});
