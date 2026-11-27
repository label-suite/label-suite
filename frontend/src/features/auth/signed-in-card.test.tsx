/**
 * The temporary landing page's card (spec auth-guard 「暫時落點顯示目前登入者」;
 * ui-design §元件樹 › 暫時落點). Signing out moved to the sidebar
 * (use-sign-out.test.tsx), so the card has no button.
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/app/query-client";
import type { SessionUserData } from "@/api/generated/label-suite.schemas";
import { server } from "@/test/msw-server";
import { SAMPLE_ADMIN, SPEC_MEMBER, signedInHandler } from "@/test/session-fixtures";

import { RequireAuthRoute } from "./route-guards";
import { sessionQueryKey, type SessionState } from "./session-query";
import { SignedInCard } from "./signed-in-card";

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

describe("SignedInCard", () => {
  it("平台成員看到自己的身分: identity, role and note, and no sign-out button", async () => {
    renderLanding();

    const region = await screen.findByRole("region", { name: "你已登入" });
    expect(within(region).getByRole("heading", { level: 1 })).toHaveTextContent("你已登入");
    expect(within(region).getByText("王小明（user@example.com）")).toBeInTheDocument();
    expect(within(region).getByText("平台成員")).toHaveAttribute("data-variant", "role");
    expect(
      within(region).getByText("儀表板還在建置中，完成後登入會直接帶你過去。"),
    ).toBeInTheDocument();
    expect(within(region).queryByRole("button")).toBeNull();
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
