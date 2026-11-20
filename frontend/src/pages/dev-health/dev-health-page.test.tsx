import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { i18n, resolveLanguage } from "@/lib/i18n";
import { HEALTH_OK_TRACE_ID, HEALTH_URL, healthOkHandler } from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";

import { DevHealthPage } from "./index";

/** Every request MSW saw: method, URL and the headers the tests check. */
interface SeenRequest {
  /** `GET http://...` */
  target: string;
  /** The Accept-Language header. */
  acceptLanguage: string | null;
  /** The Cookie header. */
  cookie: string | null;
}

let seen: SeenRequest[] = [];

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <DevHealthPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  seen = [];
  server.events.on("request:start", ({ request }) => {
    seen.push({
      target: `${request.method} ${request.url}`,
      acceptLanguage: request.headers.get("Accept-Language"),
      cookie: request.headers.get("Cookie"),
    });
  });
  const reported = new Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    ...reported,
    timeZone: "Asia/Taipei",
  });
  server.use(healthOkHandler());
});

afterEach(() => {
  server.events.removeAllListeners();
  vi.restoreAllMocks();
  document.title = "";
});

describe("DevHealthPage", () => {
  it("calls only the health endpoint and shows the page header", async () => {
    renderPage();

    expect(await screen.findByText("正常")).toBeInTheDocument();
    expect(seen.map((request) => request.target)).toEqual([`GET ${HEALTH_URL}`]);
    expect(screen.getByText("DEV ONLY · /dev/health")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("系統健康檢查");
    expect(screen.getByText("GET /api/v1/health").tagName).toBe("CODE");
  });

  it("shows the full result to a caller without any credentials", async () => {
    expect(document.cookie).toBe("");
    renderPage();

    expect(await screen.findByText("正常")).toBeInTheDocument();
    expect(seen[0]?.cookie).toBeNull();
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "服務",
      "資料庫",
      "檢查時間",
      "traceId",
    ]);
    expect(screen.getByText(HEALTH_OK_TRACE_ID)).toBeInTheDocument();
    expect(screen.getByText("2026-11-20 16:15:30（UTC+8）")).toBeInTheDocument();
    expect(screen.queryByText("已遮蔽")).not.toBeInTheDocument();
  });

  it("sets the browser title to Label Suite — <page name>", () => {
    renderPage();

    expect(document.title).toBe("Label Suite — 系統健康檢查");
  });

  it("shows English text and asks for English when the browser language is en-US", async () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    await i18n.changeLanguage(resolveLanguage(navigator.language));
    renderPage();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).not.toHaveTextContent("系統健康檢查");
    expect(heading).toHaveTextContent("System health check");
    expect(document.title).toBe("Label Suite — System health check");
    expect(await screen.findByText("Healthy")).toBeInTheDocument();
    expect(seen.map((request) => request.acceptLanguage)).toEqual(["en"]);
  });
});
