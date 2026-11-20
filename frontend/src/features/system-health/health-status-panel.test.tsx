/**
 * Integration tests of the health panel: the public entry (which registers the
 * systemHealth namespace), MSW at the network edge, a real QueryClient and the
 * real apiFetch. The device time zone is pinned to Asia/Taipei through
 * resolvedOptions, the same path the panel uses at runtime (design D12).
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, type HttpHandler } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { i18n } from "@/lib/i18n";
import {
  DATABASE_UNAVAILABLE_TRACE_ID,
  HEALTH_OK_TRACE_ID,
  HEALTH_URL,
  errorBody,
  healthDatabaseUnavailableHandler,
  healthNetworkErrorHandler,
  healthOkBody,
  healthOkHandler,
  healthPendingHandler,
} from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";

import { HealthStatusPanel } from "./index";

const LOADING_TEXT = "正在檢查後端狀態…";

/** A handler that holds every request until the test releases it. */
interface Gate {
  /** The handler to add with server.use(). */
  handler: HttpHandler;
  /** Requests that reached the handler. */
  started: () => number;
  /** Requests whose signal was aborted. */
  aborted: () => number;
  /** Answers every waiting request with a fresh response from `make`. */
  release: (make: () => Response) => void;
}

function gatedHealth(): Gate {
  const waiting: ((make: () => Response) => void)[] = [];
  let started = 0;
  let aborted = 0;
  const handler = http.get(HEALTH_URL, async ({ request }) => {
    started += 1;
    request.signal.addEventListener("abort", () => {
      aborted += 1;
    });
    const make = await new Promise<() => Response>((resolve) => {
      waiting.push(resolve);
    });
    return make();
  });
  return {
    handler,
    started: () => started,
    aborted: () => aborted,
    release: (make) => {
      for (const resolve of waiting.splice(0)) {
        resolve(make);
      }
    },
  };
}

const okResponse = (): Response => HttpResponse.json(healthOkBody(), { status: 200 });
const databaseDownResponse = (): Response =>
  HttpResponse.json(errorBody({ code: "DATABASE_UNAVAILABLE" }), { status: 503 });

function renderPanel(client: QueryClient = createQueryClient()) {
  const view = render(
    <QueryClientProvider client={client}>
      <HealthStatusPanel />
    </QueryClientProvider>,
  );
  return { ...view, client };
}

/** The panel's polite live region. */
function liveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('[aria-live="polite"]');
  if (region === null) {
    throw new Error("The panel has no polite live region");
  }
  return region;
}

/** The description list as label → value pairs, in order. */
function descriptionList(): [string, string][] {
  const terms = screen.getAllByRole("term");
  const definitions = screen.getAllByRole("definition");
  return terms.map((term, index) => [term.textContent, definitions[index]?.textContent ?? ""]);
}

function recheckButton(): HTMLElement {
  return screen.getByRole("button", { name: "重新檢查" });
}

beforeEach(() => {
  const reported = new Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    ...reported,
    timeZone: "Asia/Taipei",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("HealthStatusPanel loading", () => {
  it("shows the loading state until the response arrives", async () => {
    const gate = gatedHealth();
    server.use(gate.handler);
    const { container } = renderPanel();

    expect(screen.getByRole("status")).toHaveTextContent(LOADING_TEXT);
    expect(liveRegion(container)).toHaveAttribute("aria-busy", "true");
    expect(recheckButton()).toHaveAttribute("aria-disabled", "true");
    expect(recheckButton()).toHaveAttribute("data-variant", "outline");
    const bars = container.querySelectorAll('[data-slot="skeleton"]');
    expect(bars).toHaveLength(3);
    bars.forEach((bar) => {
      expect(bar).toHaveAttribute("aria-hidden", "true");
    });

    await waitFor(() => {
      expect(gate.started()).toBe(1);
    });
    gate.release(okResponse);

    expect(await screen.findByText("正常")).toBeInTheDocument();
    expect(liveRegion(container)).not.toHaveAttribute("aria-busy");
    expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument();
  });

  it("stays loading without an error layout when the first request is cancelled", async () => {
    server.use(healthPendingHandler());
    const { client, container } = renderPanel();

    await act(async () => {
      await client.cancelQueries();
    });

    expect(screen.getByRole("status")).toHaveTextContent(LOADING_TEXT);
    expect(liveRegion(container)).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("HealthStatusPanel ok", () => {
  it("shows the healthy badge and the four rows in the device time zone", async () => {
    server.use(healthOkHandler());
    renderPanel();

    expect(await screen.findByText("正常")).toBeInTheDocument();
    expect(screen.getByText("後端與資料庫都可以用")).toBeInTheDocument();
    expect(descriptionList()).toEqual([
      ["服務", "ok"],
      ["資料庫", "ok"],
      ["檢查時間", "2026-11-20 16:15:30（UTC+8）"],
      ["traceId", HEALTH_OK_TRACE_ID],
    ]);
    expect(recheckButton()).toHaveAttribute("data-variant", "outline");
    expect(recheckButton()).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends exactly one request, to the health endpoint", async () => {
    const urls: string[] = [];
    server.events.on("request:start", ({ request }) => {
      urls.push(`${request.method} ${request.url}`);
    });
    server.use(healthOkHandler());
    renderPanel();

    expect(await screen.findByText("正常")).toBeInTheDocument();
    expect(urls).toEqual([`GET ${HEALTH_URL}`]);
    server.events.removeAllListeners();
  });
});

describe("HealthStatusPanel backend errors", () => {
  it("shows database unavailable with the backend message verbatim", async () => {
    server.use(healthDatabaseUnavailableHandler());
    renderPanel();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("資料庫無法連線")).toBeInTheDocument();
    expect(within(alert).getByText("資料庫暫時無法連線，請稍後再試")).toBeInTheDocument();
    expect(descriptionList()).toEqual([
      ["錯誤碼", "DATABASE_UNAVAILABLE"],
      ["traceId", DATABASE_UNAVAILABLE_TRACE_ID],
    ]);
    expect(recheckButton()).toHaveAttribute("data-variant", "default");
  });

  it.each([
    [500, "INTERNAL_ERROR", "系統發生錯誤，請稍後再試"],
    [404, "NOT_FOUND", "找不到指定的資源"],
  ] as const)("shows the generic title for %i %s", async (status, code, message) => {
    server.use(http.get(HEALTH_URL, () => HttpResponse.json(errorBody({ code }), { status })));
    renderPanel();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("後端回報錯誤")).toBeInTheDocument();
    expect(within(alert).getByText(message)).toBeInTheDocument();
    expect(descriptionList()[0]).toEqual(["錯誤碼", code]);
  });
});

describe("HealthStatusPanel unreachable", () => {
  it("shows unreachable with error type network when the connection fails", async () => {
    server.use(healthNetworkErrorHandler());
    renderPanel();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("連不到後端")).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      "沒有收到任何回應。請確認後端已啟動，且 VITE_API_BASE_URL 指向它。",
    );
    expect(within(alert).getByText("VITE_API_BASE_URL").tagName).toBe("CODE");
    expect(descriptionList()).toEqual([
      ["錯誤類型", "network"],
      ["traceId", "無（請求沒有送達）"],
    ]);
    expect(recheckButton()).toHaveAttribute("data-variant", "default");
  });

  it("shows error type timeout after 15 seconds without a response", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    server.use(healthPendingHandler());
    renderPanel();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByText("連不到後端")).toBeInTheDocument();
    expect(descriptionList()[0]).toEqual(["錯誤類型", "timeout"]);
  });

  it("shows error type network for a 502 with an HTML body", async () => {
    server.use(
      http.get(
        HEALTH_URL,
        () =>
          new HttpResponse("<html><body>Bad Gateway</body></html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );
    renderPanel();

    expect(await screen.findByText("連不到後端")).toBeInTheDocument();
    expect(descriptionList()[0]).toEqual(["錯誤類型", "network"]);
  });
});

describe("HealthStatusPanel recheck", () => {
  it("goes back to loading, then shows the new result, keeping focus on the button", async () => {
    const user = userEvent.setup();
    server.use(healthDatabaseUnavailableHandler());
    renderPanel();
    expect(await screen.findByText("資料庫無法連線")).toBeInTheDocument();

    const gate = gatedHealth();
    server.use(gate.handler);
    await user.click(recheckButton());

    expect(screen.getByRole("status")).toHaveTextContent(LOADING_TEXT);
    expect(recheckButton()).toHaveAttribute("aria-disabled", "true");
    expect(recheckButton()).toHaveFocus();

    await waitFor(() => {
      expect(gate.started()).toBe(1);
    });
    gate.release(okResponse);

    expect(await screen.findByText("正常")).toBeInTheDocument();
    expect(recheckButton()).toHaveFocus();
  });

  it("sends one request when clicked again and Enter is pressed while it is in flight", async () => {
    const user = userEvent.setup();
    server.use(healthOkHandler());
    renderPanel();
    expect(await screen.findByText("正常")).toBeInTheDocument();

    const gate = gatedHealth();
    server.use(gate.handler);
    await user.click(recheckButton());
    await waitFor(() => {
      expect(gate.started()).toBe(1);
    });
    await user.click(recheckButton());
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    gate.release(okResponse);
    expect(await screen.findByText("正常")).toBeInTheDocument();
    expect(gate.started()).toBe(1);
    expect(gate.aborted()).toBe(0);
  });
});

describe("HealthStatusPanel background refetch", () => {
  it("keeps the previous result instead of going back to loading", async () => {
    server.use(healthOkHandler());
    const { client } = renderPanel();
    expect(await screen.findByText("正常")).toBeInTheDocument();

    const gate = gatedHealth();
    server.use(gate.handler);
    void client.refetchQueries();
    await waitFor(() => {
      expect(gate.started()).toBe(1);
    });

    expect(screen.getByText("正常")).toBeInTheDocument();
    expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument();
    gate.release(okResponse);
    await waitFor(() => {
      expect(recheckButton()).not.toHaveAttribute("aria-disabled");
    });
  });

  it("neither aborts nor resends when recheck is pressed during a background refetch", async () => {
    const user = userEvent.setup();
    server.use(healthOkHandler());
    const { client } = renderPanel();
    expect(await screen.findByText("正常")).toBeInTheDocument();

    const gate = gatedHealth();
    server.use(gate.handler);
    void client.refetchQueries();
    await waitFor(() => {
      expect(gate.started()).toBe(1);
    });

    expect(recheckButton()).toHaveAttribute("aria-disabled", "true");
    await user.click(recheckButton());
    expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument();

    gate.release(databaseDownResponse);
    expect(await screen.findByText("資料庫無法連線")).toBeInTheDocument();
    expect(gate.started()).toBe(1);
    expect(gate.aborted()).toBe(0);
  });
});

describe("HealthStatusPanel in English", () => {
  it("shows English interface text and the backend's English message verbatim", async () => {
    await i18n.changeLanguage("en");
    server.use(healthDatabaseUnavailableHandler());
    const { container } = renderPanel();

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("The database is temporarily unavailable. Please try again later."),
    ).toBeInTheDocument();
    expect(screen.getByText("DATABASE_UNAVAILABLE")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\p{Script=Han}/u);
    expect(screen.queryByText("資料庫無法連線")).not.toBeInTheDocument();
  });
});
