/**
 * The sign-in page (specs account-login and login-session, ui-design §元件樹 ›
 * 登入頁, §畫面狀態). Rendered behind PublicOnlyRoute in a memory router, so the
 * guard's session query runs as in the app. Full-page navigation to Google is
 * replaced by a spy.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { errorBody } from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";
import {
  AUTH_OPTIONS_URL,
  CURRENT_SESSION_URL,
  GOOGLE_AUTHORIZATION_URL,
  SESSIONS_URL,
  accountErrorResponse,
  authOptionsHandler,
  sessionBody,
  sessionCreatedResponse,
  signedOutHandlers,
} from "@/test/session-fixtures";

import { goToExternalUrl } from "./external-navigation";
import { LoginView } from "./login-view";
import { PublicOnlyRoute } from "./route-guards";

vi.mock("./external-navigation", () => ({ goToExternalUrl: vi.fn() }));

const GOOGLE_URL = "https://accounts.google.com/o/oauth2/v2/auth?state=s1";
const TYPED = "correct horse";

type Router = ReturnType<typeof createMemoryRouter>;

/** Renders the sign-in page at /account/login, with `state` as the navigation state. */
function renderLogin(state?: unknown): Router {
  const router = createMemoryRouter(
    [
      {
        element: <PublicOnlyRoute />,
        children: [{ path: "/account/login", element: <LoginView /> }],
      },
      { path: "/dashboard/dashboard", element: <p>landing</p> },
      { path: "/account/register", element: <p>register page</p> },
      { path: "/account/forgot-password", element: <p>forgot page</p> },
    ],
    { initialEntries: [{ pathname: "/account/login", state }] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/** The sign-in card, once the guard has let the page through. */
async function card(): Promise<HTMLElement> {
  return screen.findByRole("region", { name: "登入" });
}

/** Counts the sign-in requests and answers each with `respond`. */
function countSignIns(respond: () => Response | Promise<Response>): { count: () => number } {
  let requests = 0;
  server.use(
    http.post(SESSIONS_URL, async () => {
      requests += 1;
      return respond();
    }),
  );
  return { count: () => requests };
}

/** Fills both fields. */
async function fillBoth(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText("電子郵件"), "user@example.com");
  await user.type(screen.getByLabelText("密碼"), TYPED);
}

/** A sign-in answer that never arrives, so the page stays in "submitting". */
async function never(): Promise<Response> {
  await delay("infinite");
  return HttpResponse.error();
}

beforeEach(() => {
  server.use(...signedOutHandlers(), authOptionsHandler());
});

afterEach(() => {
  vi.mocked(goToExternalUrl).mockReset();
  document.title = "";
});

describe("entrances", () => {
  it("shows every entrance in prototype order, and no remember-me", async () => {
    renderLogin();
    const region = await card();
    await within(region).findByRole("button", { name: "使用 Google 帳號繼續登入" });

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Label Suite 首頁" })).toHaveAttribute("href", "/");
    expect(within(region).getByRole("heading", { level: 1 })).toHaveTextContent("Label Suite");
    expect(within(region).getByText("登入你的帳號")).toBeInTheDocument();
    const order = [
      within(region).getByRole("button", { name: "使用 Google 帳號繼續登入" }),
      within(region).getByText("或"),
      within(region).getByLabelText("電子郵件"),
      within(region).getByRole("link", { name: "忘記密碼？" }),
      within(region).getByLabelText("密碼"),
      within(region).getByRole("button", { name: "登入" }),
      within(region).getByText("還沒有帳號？"),
      within(region).getByRole("link", { name: "前往註冊" }),
    ];
    for (let index = 1; index < order.length; index += 1) {
      const previous = order[index - 1];
      const next = order[index];
      if (previous === undefined || next === undefined) throw new Error("missing element");
      expect(
        previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.queryByText(/記住我/)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("hides the register row when the deployment has no mail service", async () => {
    server.use(authOptionsHandler({ googleEnabled: true, selfRegistrationEnabled: false }));
    renderLogin();
    const region = await card();

    expect(
      await within(region).findByRole("button", { name: "使用 Google 帳號繼續登入" }),
    ).toBeInTheDocument();
    expect(within(region).queryByText("還沒有帳號？")).not.toBeInTheDocument();
    expect(within(region).queryByRole("link", { name: "前往註冊" })).not.toBeInTheDocument();
    expect(within(region).getByRole("link", { name: "忘記密碼？" })).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "登入" })).toBeInTheDocument();
  });

  it("hides Google and the divider when Google is not configured", async () => {
    let answered = false;
    server.use(
      http.get(AUTH_OPTIONS_URL, () => {
        answered = true;
        return HttpResponse.json({
          success: true,
          code: "OK",
          message: "成功",
          data: { googleEnabled: false, selfRegistrationEnabled: true },
          timestamp: "2026-11-26T08:00:00.000Z",
          traceId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
        });
      }),
    );
    renderLogin();
    const region = await card();
    await within(region).findByRole("link", { name: "前往註冊" });

    expect(answered).toBe(true);
    expect(within(region).queryByRole("button", { name: /Google/ })).not.toBeInTheDocument();
    expect(within(region).queryByText("或")).not.toBeInTheDocument();
    const controls = within(region).getAllByRole("textbox");
    expect(controls[0]).toBe(within(region).getByLabelText("電子郵件"));
  });

  it("shows neither Google nor register until the options arrive, and none if they fail", async () => {
    server.use(http.get(AUTH_OPTIONS_URL, () => HttpResponse.error()));
    renderLogin();
    const region = await card();
    await waitFor(() => {
      expect(within(region).getByRole("button", { name: "登入" })).toBeInTheDocument();
    });

    expect(within(region).queryByRole("button", { name: /Google/ })).not.toBeInTheDocument();
    expect(within(region).queryByText("或")).not.toBeInTheDocument();
    expect(within(region).queryByRole("link", { name: "前往註冊" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("links to password reset and registration", async () => {
    renderLogin();
    const region = await card();

    expect(within(region).getByRole("link", { name: "忘記密碼？" })).toHaveAttribute(
      "href",
      "/account/forgot-password",
    );
    expect(await within(region).findByRole("link", { name: "前往註冊" })).toHaveAttribute(
      "href",
      "/account/register",
    );
  });
});

describe("required fields", () => {
  it.each([
    ["the Email is empty", "", TYPED, ["請輸入電子郵件"]],
    ["the Email is only spaces", "   ", TYPED, ["請輸入電子郵件"]],
    ["the password is empty", "user@example.com", "", ["請輸入密碼"]],
    ["both are empty", "", "", ["請輸入電子郵件", "請輸入密碼"]],
  ])("stops the submit when %s", async (_case, email, typed, messages) => {
    const user = userEvent.setup();
    const signIns = countSignIns(() => sessionCreatedResponse());
    renderLogin();
    await card();
    if (email !== "") await user.type(screen.getByLabelText("電子郵件"), email);
    if (typed !== "") await user.type(screen.getByLabelText("密碼"), typed);

    await user.click(screen.getByRole("button", { name: "登入" }));

    for (const message of messages) {
      expect(await screen.findByText(message)).toBeInTheDocument();
    }
    expect(signIns.count()).toBe(0);
  });

  it("ties each error to its field and clears it when the field is typed in", async () => {
    const user = userEvent.setup();
    renderLogin();
    await card();
    await user.click(screen.getByRole("button", { name: "登入" }));
    const email = screen.getByLabelText("電子郵件");

    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("請輸入電子郵件");

    await user.type(email, "u");

    expect(screen.queryByText("請輸入電子郵件")).not.toBeInTheDocument();
    expect(email).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("請輸入密碼")).toBeInTheDocument();
  });
});

describe("sign-in failures", () => {
  it("shows one sentence for wrong credentials and keeps both fields", async () => {
    const user = userEvent.setup();
    countSignIns(() => accountErrorResponse("ACCOUNT_INVALID_CREDENTIALS", 401));
    renderLogin();
    await card();
    await fillBoth(user);

    await user.click(screen.getByRole("button", { name: "登入" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("帳號或密碼錯誤，請再試一次");
    expect(screen.getByLabelText("電子郵件")).toHaveValue("user@example.com");
    expect(screen.getByLabelText("密碼")).toHaveValue(TYPED);
  });

  it("closes the banner when either field is typed in", async () => {
    const user = userEvent.setup();
    countSignIns(() => accountErrorResponse("ACCOUNT_INVALID_CREDENTIALS", 401));
    renderLogin();
    await card();
    await fillBoth(user);
    await user.click(screen.getByRole("button", { name: "登入" }));
    await screen.findByRole("alert");

    await user.type(screen.getByLabelText("密碼"), "x");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["the connection fails", () => HttpResponse.error()],
    [
      "the server answers 500",
      () => HttpResponse.json(errorBody({ code: "INTERNAL_ERROR" }), { status: 500 }),
    ],
  ])("shows the retry sentence when %s", async (_case, respond) => {
    const user = userEvent.setup();
    countSignIns(respond);
    renderLogin();
    await card();
    await fillBoth(user);

    await user.click(screen.getByRole("button", { name: "登入" }));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("平台暫時沒有回應，請稍後再試。");
    expect(banner).not.toHaveTextContent("帳號或密碼錯誤");
    expect(screen.getByLabelText("電子郵件")).toHaveValue("user@example.com");
    expect(screen.getByLabelText("密碼")).toHaveValue(TYPED);
    expect(screen.getByRole("button", { name: "登入" })).not.toHaveAttribute("aria-disabled");
  });
});

/** Answers the authorisation URL request with `url`, counting the requests. */
function answerGoogleUrl(url: string): { count: () => number } {
  let requests = 0;
  server.use(
    http.get(GOOGLE_AUTHORIZATION_URL, () => {
      requests += 1;
      return HttpResponse.json({
        success: true,
        code: "OK",
        message: "成功",
        data: { authorizationUrl: url },
        timestamp: "2026-11-26T08:00:00.000Z",
        traceId: "5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8091",
      });
    }),
  );
  return { count: () => requests };
}

describe("before the page re-renders", () => {
  it("sends one sign-in when the form is submitted twice in the same tick", async () => {
    const user = userEvent.setup();
    const signIns = countSignIns(never);
    renderLogin();
    await card();
    await fillBoth(user);
    const form = screen.getByRole("button", { name: "登入" }).closest("form");
    if (form === null) throw new Error("no form");

    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });

    await screen.findByRole("button", { name: "載入中" });
    expect(signIns.count()).toBe(1);
  });

  it("asks for one Google URL when the button is pressed twice in the same tick", async () => {
    const requests = answerGoogleUrl(GOOGLE_URL);
    renderLogin();
    const button = await within(await card()).findByRole("button", {
      name: "使用 Google 帳號繼續登入",
    });

    act(() => {
      button.click();
      button.click();
    });

    await waitFor(() => {
      expect(goToExternalUrl).toHaveBeenCalledTimes(1);
    });
    expect(requests.count()).toBe(1);
  });
});

describe("unexpected answers", () => {
  it("does not follow an authorisation URL that is not http(s)", async () => {
    const user = userEvent.setup();
    answerGoogleUrl("javascript:alert(1)");
    renderLogin();

    await user.click(
      await within(await card()).findByRole("button", { name: "使用 Google 帳號繼續登入" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("平台暫時沒有回應，請稍後再試。");
    expect(goToExternalUrl).not.toHaveBeenCalled();
  });

  it("shows the retry sentence when the session cannot be read after signing in", async () => {
    const user = userEvent.setup();
    let signedIn = false;
    countSignIns(() => {
      signedIn = true;
      return sessionCreatedResponse();
    });
    server.use(
      http.get(CURRENT_SESSION_URL, () =>
        signedIn
          ? HttpResponse.json(errorBody({ code: "DATABASE_UNAVAILABLE" }), { status: 503 })
          : accountErrorResponse("AUTH_REQUIRED", 401),
      ),
    );
    const router = renderLogin();
    await card();
    await fillBoth(user);

    await user.click(screen.getByRole("button", { name: "登入" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("平台暫時沒有回應，請稍後再試。");
    expect(router.state.location.pathname).toBe("/account/login");
    expect(screen.getByRole("button", { name: "登入" })).not.toHaveAttribute("aria-disabled");
  });
});

describe("a successful sign-in", () => {
  it("clears earlier errors and goes to the landing page", async () => {
    const user = userEvent.setup();
    let signedIn = false;
    countSignIns(() => {
      signedIn = true;
      return sessionCreatedResponse();
    });
    server.use(
      http.get(CURRENT_SESSION_URL, () =>
        signedIn ? HttpResponse.json(sessionBody()) : accountErrorResponse("AUTH_REQUIRED", 401),
      ),
    );
    const router = renderLogin();
    await card();
    await user.click(screen.getByRole("button", { name: "登入" }));
    expect(screen.getByText("請輸入電子郵件")).toBeInTheDocument();

    await fillBoth(user);
    await user.click(screen.getByRole("button", { name: "登入" }));

    expect(screen.queryByText("請輸入電子郵件")).not.toBeInTheDocument();
    expect(await screen.findByText("landing")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard/dashboard");
  });
});

describe("while submitting", () => {
  it("names the progress indicator 載入中, and Loading in English", async () => {
    const user = userEvent.setup();
    countSignIns(never);
    renderLogin();
    await card();
    await fillBoth(user);

    await user.click(screen.getByRole("button", { name: "登入" }));

    expect(await screen.findByRole("button", { name: "載入中" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("names the progress indicator Loading in English", async () => {
    const user = userEvent.setup();
    countSignIns(never);
    renderLogin();
    await card();
    await user.click(screen.getByRole("button", { name: /ZH/ }));
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), TYPED);

    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("button", { name: "Loading" })).toBeInTheDocument();
  });

  it("ignores the language switch", async () => {
    const user = userEvent.setup();
    countSignIns(never);
    renderLogin();
    await card();
    await fillBoth(user);
    await user.click(screen.getByRole("button", { name: "登入" }));
    await screen.findByRole("button", { name: "載入中" });

    await user.click(screen.getByRole("button", { name: /ZH/ }));

    expect(screen.getByLabelText("電子郵件")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ZH/ })).toBeDisabled();
    expect(document.documentElement.lang).toBe("zh-TW");
  });

  it("ignores the register link, the forgot link and the fields", async () => {
    const user = userEvent.setup();
    countSignIns(never);
    const router = renderLogin();
    const region = await card();
    await within(region).findByRole("link", { name: "前往註冊" });
    await fillBoth(user);
    await user.click(screen.getByRole("button", { name: "登入" }));
    await screen.findByRole("button", { name: "載入中" });

    await user.click(within(region).getByRole("link", { name: "前往註冊" }));
    await user.click(within(region).getByRole("link", { name: "忘記密碼？" }));

    expect(router.state.location.pathname).toBe("/account/login");
    expect(screen.getByLabelText("電子郵件")).toBeDisabled();
    expect(screen.getByLabelText("密碼")).toBeDisabled();
    expect(within(region).getByRole("button", { name: "使用 Google 帳號繼續登入" })).toBeDisabled();
    expect(within(region).getByRole("button", { name: "顯示密碼" })).toBeDisabled();
  });

  it("sends one request however often the button is pressed", async () => {
    const user = userEvent.setup();
    const signIns = countSignIns(never);
    renderLogin();
    await card();
    await fillBoth(user);

    await user.click(screen.getByRole("button", { name: "登入" }));
    const busy = await screen.findByRole("button", { name: "載入中" });
    await user.click(busy);
    await user.click(busy);
    await user.keyboard("{Enter}");
    await user.click(busy);

    expect(signIns.count()).toBe(1);
  });
});

describe("password visibility", () => {
  it("shows and hides the password, renaming the toggle", async () => {
    const user = userEvent.setup();
    renderLogin();
    await card();
    const field = screen.getByLabelText("密碼");
    await user.type(field, TYPED);
    expect(field).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "顯示密碼" }));
    expect(field).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "隱藏密碼" }));
    expect(field).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "顯示密碼" })).toBeInTheDocument();
  });

  it("keeps the password visible across a language switch", async () => {
    const user = userEvent.setup();
    renderLogin();
    await card();
    await user.type(screen.getByLabelText("密碼"), TYPED);
    await user.click(screen.getByRole("button", { name: "顯示密碼" }));

    await user.click(screen.getByRole("button", { name: /ZH/ }));

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });
});

describe("Google sign-in", () => {
  it("fetches the authorisation URL and goes there with a full-page navigation", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(GOOGLE_AUTHORIZATION_URL, () =>
        HttpResponse.json({
          success: true,
          code: "OK",
          message: "成功",
          data: { authorizationUrl: GOOGLE_URL },
          timestamp: "2026-11-26T08:00:00.000Z",
          traceId: "5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8091",
        }),
      ),
    );
    renderLogin();
    const region = await card();

    await user.click(
      await within(region).findByRole("button", { name: "使用 Google 帳號繼續登入" }),
    );

    await waitFor(() => {
      expect(goToExternalUrl).toHaveBeenCalledWith(GOOGLE_URL);
    });
  });

  it("goes to Google only once when the button is clicked three times", async () => {
    const user = userEvent.setup();
    let requests = 0;
    server.use(
      http.get(GOOGLE_AUTHORIZATION_URL, async () => {
        requests += 1;
        await delay(30);
        return HttpResponse.json({
          success: true,
          code: "OK",
          message: "成功",
          data: { authorizationUrl: GOOGLE_URL },
          timestamp: "2026-11-26T08:00:00.000Z",
          traceId: "5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8091",
        });
      }),
    );
    renderLogin();
    const button = await within(await card()).findByRole("button", {
      name: "使用 Google 帳號繼續登入",
    });

    await user.click(button);
    await user.click(button);
    await user.click(button);

    await waitFor(() => {
      expect(goToExternalUrl).toHaveBeenCalledTimes(1);
    });
    expect(requests).toBe(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the retry sentence and unfreezes when the URL cannot be fetched", async () => {
    const user = userEvent.setup();
    server.use(http.get(GOOGLE_AUTHORIZATION_URL, () => HttpResponse.error()));
    renderLogin();
    const button = await within(await card()).findByRole("button", {
      name: "使用 Google 帳號繼續登入",
    });

    await user.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent("平台暫時沒有回應，請稍後再試。");
    expect(button).toBeEnabled();
    expect(screen.getByLabelText("電子郵件")).toBeEnabled();
    expect(goToExternalUrl).not.toHaveBeenCalled();
  });

  it("shows the Google sentence it was sent back with, once", async () => {
    const router = renderLogin({ loginNotice: "googleRejected" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "無法用這個 Google 帳號登入。需要帳號的話，請聯絡系統管理員邀請你。",
    );
    await waitFor(() => {
      expect(router.state.location.state).toBeNull();
    });
    expect(router.state.location.pathname).toBe("/account/login");
  });

  it("ignores a navigation state it does not recognise", async () => {
    renderLogin({ loginNotice: "<script>" });
    await card();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("language switch", () => {
  it("shows only the code, with a name that contains it", async () => {
    renderLogin();
    await card();

    const toggle = screen.getByRole("button", { name: /ZH/ });
    expect(toggle).toHaveTextContent(/^ZH$/);
    expect(toggle).toHaveAccessibleName("ZH，切換語言");
  });

  it("switches the whole page at once and back again", async () => {
    const user = userEvent.setup();
    renderLogin();
    const region = await card();
    await within(region).findByRole("button", { name: "使用 Google 帳號繼續登入" });

    await user.click(screen.getByRole("button", { name: /ZH/ }));

    const english = screen.getByRole("region", { name: "Sign in" });
    expect(within(english).getByText("Sign in to your account")).toBeInTheDocument();
    expect(within(english).getByLabelText("Email")).toBeInTheDocument();
    expect(within(english).getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(within(english).getByText("Continue with Google")).toBeInTheDocument();
    expect(
      within(english).getByRole("button", { name: "Continue with Google account" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN, Switch language" })).toHaveTextContent(/^EN$/);
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("Label Suite — Sign In");

    await user.click(screen.getByRole("button", { name: /EN/ }));

    expect(screen.getByRole("region", { name: "登入" })).toBeInTheDocument();
    expect(screen.getByText("登入你的帳號")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("zh-TW");
    expect(document.title).toBe("Label Suite — 登入");
  });

  it("clears the field errors and the banner", async () => {
    const user = userEvent.setup();
    renderLogin({ loginNotice: "sessionExpired" });
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "登入" }));
    expect(screen.getByText("請輸入電子郵件")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ZH/ }));

    expect(screen.queryByText("Email is required")).not.toBeInTheDocument();
    expect(screen.queryByText("請輸入電子郵件")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
