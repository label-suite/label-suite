/**
 * How a page uses the shared screen (specs/denied-and-not-found-screens;
 * design D2): it classifies the read's rejection with classifyRejection and,
 * for denied or notFound, draws BlockedScreen in place of its content area.
 * No product page does this yet, so an illustrative page lives in this file.
 * It sits under pages/ because components/ may only import lib/.
 */
import { render, screen, within } from "@testing-library/react";
import { Trans } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ApiError, classifyRejection } from "@/api/api-error";
import { BlockedIdentifier, BlockedScreen } from "@/components/blocked-screen";

const TASK_ID = "demo-task-001";
const BACK_TO = "/dashboard/dashboard";
const BACK_LABEL = "回儀表板";
const EMPTY_TEXT = "目前沒有任何標記項目";

const COPY = {
  notFound: {
    title: "找不到這個任務",
    description: "任務代碼 <identifier/> 不存在，請確認網址或回到儀表板重新選擇任務。",
  },
  denied: {
    title: "無權限檢視此任務",
    description: "你目前無權限檢視任務代碼 <identifier/>，請回到儀表板或聯絡管理員。",
  },
} as const;

/** The 404 NOT_FOUND envelope of api-contract §錯誤外層, as apiFetch turns it into an ApiError. */
const CONTRACT_NOT_FOUND = {
  success: false,
  code: "NOT_FOUND",
  message: "找不到指定的資源",
  data: null,
  timestamp: "2026-11-27T08:00:00.000Z",
  traceId: "3f2b9c1e-0000-4000-8000-000000000000",
  errors: null,
} as const;

function contractNotFound(): ApiError {
  return new ApiError({
    kind: "http",
    status: 404,
    code: CONTRACT_NOT_FOUND.code,
    message: CONTRACT_NOT_FOUND.message,
    traceId: CONTRACT_NOT_FOUND.traceId,
    timestamp: CONTRACT_NOT_FOUND.timestamp,
    fieldErrors: CONTRACT_NOT_FOUND.errors,
  });
}

function missingTask(): ApiError {
  return new ApiError({ kind: "http", status: 404, code: "NOT_FOUND", message: "not found" });
}

function deniedTask(): ApiError {
  return new ApiError({
    kind: "http",
    status: 403,
    code: "PERMISSION_DENIED",
    message: "你沒有執行這個操作的權限",
  });
}

/** Props of {@link IllustrativeTaskPage}. */
interface IllustrativeTaskPageProps {
  /** The read's rejection, or null when the read succeeded with no items. */
  error: unknown;
}

/** A page whose content area is an empty item list until a read is rejected. */
function IllustrativeTaskPage({ error }: IllustrativeTaskPageProps) {
  const rejection = classifyRejection(error);

  return (
    <main aria-label="內容區">
      {rejection === "other" ? (
        <>
          <table>
            <tbody />
          </table>
          <ul />
          <p>{EMPTY_TEXT}</p>
        </>
      ) : (
        <BlockedScreen
          kind={rejection}
          title={COPY[rejection].title}
          description={
            <Trans
              i18nKey={`blockedFlowTest.${rejection}`}
              defaults={COPY[rejection].description}
              components={{ identifier: <BlockedIdentifier value={TASK_ID} /> }}
            />
          }
          backTo={BACK_TO}
          backLabel={BACK_LABEL}
        />
      )}
    </main>
  );
}

function renderPage(error: unknown) {
  return render(<IllustrativeTaskPage error={error} />, { wrapper: MemoryRouter });
}

/** Markup with React's generated heading ids blanked, which differ between two renders. */
function withoutGeneratedIds(markup: string): string {
  return markup.replace(/(id|aria-labelledby)="[^"]*"/g, '$1=""');
}

function contentArea(): HTMLElement {
  return screen.getByRole("main", { name: "內容區" });
}

describe("a page that draws the blocked screen from a classified rejection", () => {
  it("replaces an empty list with the not-found screen instead of showing it blank", () => {
    const { rerender } = renderPage(null);
    expect(within(contentArea()).getByRole("table")).toBeInTheDocument();
    expect(within(contentArea()).getByText(EMPTY_TEXT)).toBeInTheDocument();

    rerender(<IllustrativeTaskPage error={missingTask()} />);

    const area = contentArea();
    expect(within(area).getByRole("region", { name: COPY.notFound.title })).toHaveAttribute(
      "data-kind",
      "notFound",
    );
    expect(within(area).queryByRole("table")).not.toBeInTheDocument();
    expect(within(area).queryByRole("list")).not.toBeInTheDocument();
    expect(within(area).queryByRole("listitem")).not.toBeInTheDocument();
    expect(within(area).queryByText(EMPTY_TEXT)).not.toBeInTheDocument();
  });

  it("draws the denied screen for 403 PERMISSION_DENIED and never the not-found one", () => {
    renderPage(deniedTask());

    const region = screen.getByRole("region", { name: COPY.denied.title });
    expect(region).toHaveAttribute("data-kind", "denied");
    expect(screen.queryByText(COPY.notFound.title)).not.toBeInTheDocument();
    expect(document.querySelector('[data-kind="notFound"]')).toBeNull();
  });

  it("draws the same not-found screen for a hidden record as for a missing one", () => {
    const { container: hidden } = renderPage(contractNotFound());
    const hiddenText = contentArea().textContent;
    const hiddenMarkup = withoutGeneratedIds(hidden.innerHTML);
    // Both renders share the same document, so read the hidden one before the second.
    hidden.remove();
    const { container: missing } = renderPage(missingTask());

    expect(hiddenMarkup).toBe(withoutGeneratedIds(missing.innerHTML));
    expect(hiddenText).not.toContain(CONTRACT_NOT_FOUND.message);
    expect(hiddenText).not.toContain(CONTRACT_NOT_FOUND.traceId);
    expect(hiddenText).not.toContain("測試集");
    expect(screen.getByRole("region")).toHaveAttribute("data-kind", "notFound");
  });

  it("shows not found, with only its title, description and link, when both conditions hold", () => {
    renderPage(missingTask());

    const area = contentArea();
    expect(within(area).getByRole("region")).toHaveAttribute("data-kind", "notFound");
    expect(within(area).queryByText(COPY.denied.title)).not.toBeInTheDocument();
    expect(area.textContent).toBe(
      `${COPY.notFound.title}任務代碼 ${TASK_ID} 不存在，請確認網址或回到儀表板重新選擇任務。${BACK_LABEL}`,
    );
  });
});
