/**
 * Signing out of this browser (spec login-session 「從這一台登出」; sidebar-nav
 * design D11). useSignOut sends one request per press, whatever the answer
 * marks the session signed out, and reports progress so every sign-out
 * button in the shell can show it.
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { errorBody } from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";
import { CURRENT_SESSION_URL, SPEC_MEMBER, signedInHandler } from "@/test/session-fixtures";

import { RequireAuthRoute } from "./route-guards";
import { useSignOut } from "./use-sign-out";

type Router = ReturnType<typeof createMemoryRouter>;

/** A stand-in for a shell sign-out button. */
function SignOutProbe() {
  const { signOut, signingOut } = useSignOut();
  return (
    <button type="button" aria-busy={signingOut} onClick={signOut}>
      {signingOut ? "signing out" : "sign out"}
    </button>
  );
}

/** Renders the probe behind RequireAuthRoute, signed in, under StrictMode. */
function renderSignedIn(client: QueryClient = createQueryClient()) {
  server.use(signedInHandler(SPEC_MEMBER));
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuthRoute />,
        children: [{ path: "/dashboard/dashboard", element: <SignOutProbe /> }],
      },
      { path: "/account/login", element: <p>login page</p> },
    ],
    { initialEntries: ["/account/login", "/dashboard/dashboard"], initialIndex: 1 },
  );
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
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

async function expectPath(router: Router, pathname: string): Promise<void> {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(pathname);
  });
}

describe("useSignOut", () => {
  it("sends one request when pressed twice in the same tick", async () => {
    const signOuts = countSignOuts(async () => {
      await delay("infinite");
      return HttpResponse.error();
    });
    renderSignedIn();
    const button = await screen.findByRole("button", { name: "sign out" });

    act(() => {
      button.click();
      button.click();
    });

    expect(await screen.findByRole("button", { name: "signing out" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(signOuts.count()).toBe(1);
  });

  it("sends one request while one is in flight", async () => {
    const user = userEvent.setup();
    const signOuts = countSignOuts(async () => {
      await delay("infinite");
      return HttpResponse.error();
    });
    renderSignedIn();

    await user.click(await screen.findByRole("button", { name: "sign out" }));
    await user.click(await screen.findByRole("button", { name: "signing out" }));

    expect(signOuts.count()).toBe(1);
  });

  it("signs out and goes to the sign-in page, replacing the history entry", async () => {
    const user = userEvent.setup();
    const signOuts = countSignOuts(() => new HttpResponse(null, { status: 204 }));
    const { router, client } = renderSignedIn();

    await user.click(await screen.findByRole("button", { name: "sign out" }));

    await expectPath(router, "/account/login");
    expect(signOuts.count()).toBe(1);
    expect(router.state.historyAction).toBe("REPLACE");
    expect(
      client
        .getQueryCache()
        .findAll()
        .map((query) => query.state.data),
    ).toEqual([{ kind: "signedOut", notice: null }]);
  });

  it.each([
    ["登出失敗時畫面仍回到登入頁: no answer", () => HttpResponse.error()],
    [
      "the server answers 503",
      () => HttpResponse.json(errorBody({ code: "DATABASE_UNAVAILABLE" }), { status: 503 }),
    ],
  ])("still goes to the sign-in page when %s", async (_case, respond) => {
    const user = userEvent.setup();
    countSignOuts(respond);
    const { router } = renderSignedIn();

    await user.click(await screen.findByRole("button", { name: "sign out" }));

    await expectPath(router, "/account/login");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
