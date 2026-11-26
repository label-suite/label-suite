/**
 * The Google callback (ui-design §元件樹 › Google 回調; spec account-login
 * "Google 驗證沒通過時安靜回到登入頁", "Google 登入被拒一律同一句").
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { errorBody } from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";
import {
  CURRENT_SESSION_URL,
  GOOGLE_SESSIONS_URL,
  accountErrorResponse,
  sessionBody,
  sessionCreatedResponse,
  signedOutHandlers,
} from "@/test/session-fixtures";

import { GoogleCallbackHandler } from "./google-callback-handler";
import { PublicOnlyRoute } from "./route-guards";

type Router = ReturnType<typeof createMemoryRouter>;

/** Shows the navigation state the sign-in page was opened with. */
function LoginProbe() {
  const location = useLocation();
  return <p>login page {JSON.stringify(location.state)}</p>;
}

/** Opens the callback at `search`, with the login page before it in the history. */
function renderCallback(search: string): Router {
  const router = createMemoryRouter(
    [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: "/account/login", element: <LoginProbe /> },
          { path: "/account/google/callback", element: <GoogleCallbackHandler /> },
        ],
      },
      { path: "/dashboard/dashboard", element: <p>landing</p> },
    ],
    { initialEntries: ["/account/login", `/account/google/callback${search}`], initialIndex: 1 },
  );
  render(
    <StrictMode>
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  return router;
}

/** Counts the requests that complete the Google sign-in, answering with `respond`. */
function countCompletions(respond: () => Response): { count: () => number; bodies: unknown[] } {
  let requests = 0;
  const bodies: unknown[] = [];
  server.use(
    http.post(GOOGLE_SESSIONS_URL, async ({ request }) => {
      requests += 1;
      bodies.push(await request.json());
      return respond();
    }),
  );
  return { count: () => requests, bodies };
}

/** Waits for the router to reach `pathname`. */
async function expectPath(router: Router, pathname: string): Promise<void> {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(pathname);
  });
}

beforeEach(() => {
  server.use(...signedOutHandlers());
});

describe("GoogleCallbackHandler", () => {
  it("goes quietly back to the sign-in page when Google returns an error", async () => {
    const completions = countCompletions(() => sessionCreatedResponse());

    const router = renderCallback("?error=access_denied");

    await expectPath(router, "/account/login");
    expect(await screen.findByText("login page null")).toBeInTheDocument();
    expect(completions.count()).toBe(0);
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("sends the code and state once, even when mounted twice", async () => {
    let signedIn = false;
    const completions = countCompletions(() => {
      signedIn = true;
      return sessionCreatedResponse();
    });
    server.use(
      http.get(CURRENT_SESSION_URL, () =>
        signedIn ? HttpResponse.json(sessionBody()) : accountErrorResponse("AUTH_REQUIRED", 401),
      ),
    );

    const router = renderCallback("?code=c-1&state=s-1");

    await expectPath(router, "/dashboard/dashboard");
    expect(completions.count()).toBe(1);
    expect(completions.bodies).toEqual([{ code: "c-1", state: "s-1" }]);
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("shows nothing while the sign-in completes", async () => {
    countCompletions(() => sessionCreatedResponse());

    renderCallback("?code=c-1&state=s-1");

    await waitFor(() => {
      expect(document.body).not.toHaveTextContent("c-1");
    });
    expect(document.body).not.toHaveTextContent("s-1");
  });

  it("goes quietly back when the flow is invalid (E1)", async () => {
    countCompletions(() => accountErrorResponse("ACCOUNT_GOOGLE_FLOW_INVALID", 400));

    const router = renderCallback("?code=c-1&state=s-1");

    await expectPath(router, "/account/login");
    expect(await screen.findByText("login page null")).toBeInTheDocument();
  });

  it("asks the sign-in page for the Google sentence when the account is rejected (E2)", async () => {
    countCompletions(() => accountErrorResponse("ACCOUNT_GOOGLE_REJECTED", 401));

    const router = renderCallback("?code=c-1&state=s-1");

    await expectPath(router, "/account/login");
    expect(
      await screen.findByText('login page {"loginNotice":"googleRejected"}'),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe("");
  });

  it.each([
    [
      "a 503",
      () => HttpResponse.json(errorBody({ code: "DATABASE_UNAVAILABLE" }), { status: 503 }),
    ],
    ["a failed connection", () => HttpResponse.error()],
    ["Google being unavailable", () => accountErrorResponse("ACCOUNT_GOOGLE_UNAVAILABLE", 409)],
  ])("asks for the no-response sentence after %s", async (_case, respond) => {
    countCompletions(respond);

    const router = renderCallback("?code=c-1&state=s-1");

    await expectPath(router, "/account/login");
    expect(await screen.findByText('login page {"loginNotice":"unavailable"}')).toBeInTheDocument();
  });

  it("asks for the no-response sentence when the session cannot be read afterwards", async () => {
    countCompletions(() => sessionCreatedResponse());
    server.use(http.get(CURRENT_SESSION_URL, () => HttpResponse.error()));

    const router = renderCallback("?code=c-1&state=s-1");

    await expectPath(router, "/account/login");
    expect(await screen.findByText(/"loginNotice":"unavailable"/)).toBeInTheDocument();
  });

  it("goes quietly back when the code or state is missing", async () => {
    const completions = countCompletions(() => sessionCreatedResponse());

    const router = renderCallback("?code=c-1");

    await expectPath(router, "/account/login");
    expect(completions.count()).toBe(0);
  });
});
