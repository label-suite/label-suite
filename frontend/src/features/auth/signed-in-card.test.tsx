/**
 * The temporary landing page's card and sign-out (spec auth-guard
 * "暫時落點顯示目前登入者並提供登出", spec login-session "從這一台登出";
 * ui-design §元件樹 › 暫時落點, §畫面狀態 › 暫時落點：登出).
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/app/query-client";
import type { SessionUserData } from "@/api/generated/label-suite.schemas";
import { errorBody } from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";
import {
  CURRENT_SESSION_URL,
  SAMPLE_ADMIN,
  SPEC_MEMBER,
  signedInHandler,
} from "@/test/session-fixtures";

import { RequireAuthRoute } from "./route-guards";
import { sessionQueryKey, type SessionState } from "./session-query";
import { SignedInCard } from "./signed-in-card";

type Router = ReturnType<typeof createMemoryRouter>;

/** Renders the landing card behind RequireAuthRoute for `user`. */
function renderLanding(
  user: SessionUserData = SPEC_MEMBER,
  client: QueryClient = createQueryClient(),
) {
  server.use(signedInHandler(user));
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuthRoute />,
        children: [{ path: "/dashboard/dashboard", element: <SignedInCard /> }],
      },
      { path: "/account/login", element: <p>login page</p> },
    ],
    { initialEntries: ["/account/login", "/dashboard/dashboard"], initialIndex: 1 },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client };
}

/** Counts the sign-out requests, answering each with `respond`. */
function countSignOuts(respond: () => Response | Promise<Response>): { count: () => number } {
  let requests = 0;
  server.use(
    http.delete(CURRENT_SESSION_URL, async () => {
      requests += 1;
      return respond();
    }),
  );
  return { count: () => requests };
}

/** Waits for the router to reach `pathname`. */
async function expectPath(router: Router, pathname: string): Promise<void> {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(pathname);
  });
}

describe("SignedInCard", () => {
  it("shows the member's identity, role, note and sign-out button, in that order", async () => {
    renderLanding();

    const region = await screen.findByRole("region", { name: "你已登入" });
    expect(within(region).getByRole("heading", { level: 1 })).toHaveTextContent("你已登入");
    expect(within(region).getByText("王小明（user@example.com）")).toBeInTheDocument();
    expect(within(region).getByText("平台成員")).toHaveAttribute("data-variant", "role");
    expect(
      within(region).getByText("儀表板還在建置中，完成後登入會直接帶你過去。"),
    ).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "登出" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByText(/專案負責人|Project Leader/)).not.toBeInTheDocument();
  });

  it("names a super_admin a system admin", async () => {
    renderLanding(SAMPLE_ADMIN);

    expect(await screen.findByText("系統管理員")).toBeInTheDocument();
    expect(screen.getByText("Admin Chen（admin@example.com）")).toBeInTheDocument();
  });

  it("shows only the Email when the name is empty", async () => {
    renderLanding({ ...SPEC_MEMBER, name: "" });

    const region = await screen.findByRole("region", { name: "你已登入" });
    expect(within(region).getByText("user@example.com")).toBeInTheDocument();
    expect(within(region).queryByText(/（/)).not.toBeInTheDocument();
  });
});

describe("SignedInCard without a session", () => {
  it("renders nothing when the cache says signed out", () => {
    const client = createQueryClient();
    const signedOut: SessionState = { kind: "signedOut", notice: null };
    client.setQueryData(sessionQueryKey, signedOut);

    const { container } = render(
      <QueryClientProvider client={client}>
        <SignedInCard />
      </QueryClientProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("LogoutButton", () => {
  it("sends one request when pressed twice in the same tick", async () => {
    const signOuts = countSignOuts(async () => {
      await delay("infinite");
      return HttpResponse.error();
    });
    renderLanding();
    const button = await screen.findByRole("button", { name: "登出" });

    act(() => {
      button.click();
      button.click();
    });

    await screen.findByRole("button", { name: "載入中" });
    expect(signOuts.count()).toBe(1);
  });

  it("signs out and goes to the sign-in page, replacing the history entry", async () => {
    const user = userEvent.setup();
    const signOuts = countSignOuts(() => new HttpResponse(null, { status: 204 }));
    const { router, client } = renderLanding();

    await user.click(await screen.findByRole("button", { name: "登出" }));

    await expectPath(router, "/account/login");
    expect(signOuts.count()).toBe(1);
    expect(router.state.historyAction).toBe("REPLACE");
    expect(screen.queryByText("王小明（user@example.com）")).not.toBeInTheDocument();
    expect(
      client
        .getQueryCache()
        .findAll()
        .map((query) => query.state.data),
    ).toEqual([{ kind: "signedOut", notice: null }]);
  });

  it.each([
    ["the connection fails", () => HttpResponse.error()],
    [
      "the server answers 503",
      () => HttpResponse.json(errorBody({ code: "DATABASE_UNAVAILABLE" }), { status: 503 }),
    ],
  ])("still goes to the sign-in page when %s", async (_case, respond) => {
    const user = userEvent.setup();
    countSignOuts(respond);
    const { router } = renderLanding();

    await user.click(await screen.findByRole("button", { name: "登出" }));

    await expectPath(router, "/account/login");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends one request while it is in progress, and shows a named spinner", async () => {
    const user = userEvent.setup();
    const signOuts = countSignOuts(async () => {
      await delay("infinite");
      return HttpResponse.error();
    });
    renderLanding();
    const button = await screen.findByRole("button", { name: "登出" });

    await user.click(button);
    const busy = await screen.findByRole("button", { name: "載入中" });
    await user.click(busy);
    await user.keyboard("{Enter}");

    expect(busy).toHaveAttribute("aria-disabled", "true");
    expect(signOuts.count()).toBe(1);
  });
});
