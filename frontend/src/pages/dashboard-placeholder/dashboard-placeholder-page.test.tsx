/**
 * The temporary landing page inside the shell (spec auth-guard
 * 「暫時落點顯示目前登入者」; sidebar-nav clarification Q2, Q4). The shell
 * itself, with its sign-out control, is drawn around it by the router; that
 * part is src/app/app-shell-layout.test.tsx.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { getGetCurrentSessionQueryKey } from "@/api/generated/label-suite";
import type { SessionUserData } from "@/api/generated/label-suite.schemas";
import { blockedNoticeState } from "@/features/app-shell";
import { SAMPLE_ADMIN, SPEC_MEMBER } from "@/test/session-fixtures";

import { DashboardPlaceholderPage } from "./index";

type Router = ReturnType<typeof createMemoryRouter>;

let router: Router | undefined;

/** Renders the page for `user`, with the session already known, as the guard leaves it. */
function renderPage(user: SessionUserData = SPEC_MEMBER): Router {
  const client = createQueryClient();
  client.setQueryData(getGetCurrentSessionQueryKey(), { kind: "signedIn", user });
  const current = createMemoryRouter(
    [
      { path: "/dashboard/dashboard", element: <DashboardPlaceholderPage /> },
      { path: "/other", element: <p>Other</p> },
    ],
    { initialEntries: ["/other"] },
  );
  router = current;
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={current} />
    </QueryClientProvider>,
  );
  return current;
}

afterEach(() => {
  router?.dispose();
  router = undefined;
  document.title = "";
});

describe("DashboardPlaceholderPage", () => {
  it("平台成員看到自己的身分: the card without a sign-out button, and no sign-in header", async () => {
    const current = renderPage();
    await act(async () => {
      await current.navigate("/dashboard/dashboard");
    });

    const card = screen.getByRole("region", { name: "你已登入" });
    expect(within(card).getByText("王小明（user@example.com）")).toBeInTheDocument();
    expect(within(card).getByText("平台成員")).toBeInTheDocument();
    expect(
      within(card).getByText("儀表板還在建置中，完成後登入會直接帶你過去。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByTestId("lang-toggle")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("系統管理員看到系統管理員", async () => {
    const current = renderPage(SAMPLE_ADMIN);
    await act(async () => {
      await current.navigate("/dashboard/dashboard");
    });

    expect(screen.getByText("系統管理員")).toBeInTheDocument();
  });

  it("落點的瀏覽器標題: Label Suite — 你已登入", async () => {
    const current = renderPage();
    await act(async () => {
      await current.navigate("/dashboard/dashboard");
    });

    expect(document.title).toBe("Label Suite — 你已登入");
  });

  it("shows the blocked explanation above the card when sent back by the sidebar", async () => {
    const current = renderPage();
    await act(async () => {
      await current.navigate("/dashboard/dashboard", {
        state: blockedNoticeState("annotation"),
      });
    });

    const alert = screen.getByRole("alert");
    const card = screen.getByRole("region", { name: "你已登入" });
    expect(alert).toHaveTextContent(
      "你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。",
    );
    expect(alert.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
