/**
 * The one-time explanation after a blocked sidebar click (sidebar-nav design
 * D5, clarification Q4; spec 07-01 §進入模組的條件 3 and note). It arrives in
 * router state, is kept in component state, and the router state is cleared,
 * so a reload, Back or Forward does not show it again.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { changeInterfaceLanguage } from "@/lib/i18n";

import { BlockedNotice, blockedNoticeState } from "./index";

const LANDING = "/dashboard/dashboard";

const ANNOTATION_ZH = "你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。";
const ANNOTATION_EN =
  "You don't have an annotation or review role in any task yet, so you can't open Annotation.";
const DATASET_ZH = "資料集分析需要你在這個任務擔任專案負責人或審核員。";

type Router = ReturnType<typeof createMemoryRouter>;

/** A history entry to start at: a path, or a path with its state. */
type Entry = string | { pathname: string; state: unknown };

let router: Router | undefined;

function routes() {
  return [
    {
      path: LANDING,
      element: (
        <>
          <BlockedNotice />
          <p>Landing</p>
        </>
      ),
    },
    { path: "/other", element: <p>Other</p> },
  ];
}

/** Renders a memory router at `entries`, optionally inside StrictMode. */
function open(entries: Entry[], strict = false): Router {
  router?.dispose();
  const current = createMemoryRouter(routes(), { initialEntries: entries });
  router = current;
  const tree: ReactNode = <RouterProvider router={current} />;
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return current;
}

/** From /other, arrives at the landing page carrying `state`, as a blocked click does. */
async function arriveBlocked(state: unknown, strict = false): Promise<Router> {
  const current = open(["/other"], strict);
  await act(async () => {
    await current.navigate(LANDING, { state });
  });
  return current;
}

afterEach(() => {
  router?.dispose();
  router = undefined;
});

describe("BlockedNotice", () => {
  it("shows the Annotation explanation in full, as an info alert", async () => {
    await arriveBlocked(blockedNoticeState("annotation"));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(ANNOTATION_ZH);
    expect(alert).toHaveAttribute("data-variant", "info");
    expect(alert.querySelector("svg")).not.toBeNull();
  });

  it("shows the Dataset Analytics explanation in full", async () => {
    await arriveBlocked(blockedNoticeState("datasetAnalysis"));

    expect(screen.getByRole("alert")).toHaveTextContent(DATASET_ZH);
  });

  it("clears the router state but keeps showing the explanation", async () => {
    const current = await arriveBlocked(blockedNoticeState("annotation"));

    await waitFor(() => {
      expect(current.state.location.state).toBeNull();
    });
    expect(current.state.location.pathname).toBe(LANDING);
    expect(current.state.location.search).toBe("");
    expect(screen.getByRole("alert")).toHaveTextContent(ANNOTATION_ZH);
  });

  it("stays after switching to English, in English", async () => {
    const current = await arriveBlocked(blockedNoticeState("annotation"));
    await waitFor(() => {
      expect(current.state.location.state).toBeNull();
    });

    await act(async () => {
      await changeInterfaceLanguage("en");
    });

    expect(screen.getByRole("alert")).toHaveTextContent(ANNOTATION_EN);
  });

  it("is gone after a reload of the same history entry", async () => {
    const current = await arriveBlocked(blockedNoticeState("annotation"));
    await waitFor(() => {
      expect(current.state.location.state).toBeNull();
    });
    const pathname = current.state.location.pathname;
    const state: unknown = current.state.location.state;

    // Reload: the page is rebuilt from the same entry, whose state is now empty.
    document.body.innerHTML = "";
    open([{ pathname, state }]);

    expect(await screen.findByText("Landing")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("is gone after Back then Forward", async () => {
    const current = await arriveBlocked(blockedNoticeState("annotation"));
    await waitFor(() => {
      expect(current.state.location.state).toBeNull();
    });

    await act(async () => {
      await current.navigate(-1);
    });
    expect(await screen.findByText("Other")).toBeInTheDocument();
    await act(async () => {
      await current.navigate(1);
    });

    expect(await screen.findByText("Landing")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("is gone after moving to another route", async () => {
    const current = await arriveBlocked(blockedNoticeState("annotation"));

    await act(async () => {
      await current.navigate("/other");
    });

    expect(await screen.findByText("Other")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows again, remounted, when blocked again while already on the landing page", async () => {
    const current = await arriveBlocked(blockedNoticeState("annotation"));
    await waitFor(() => {
      expect(current.state.location.state).toBeNull();
    });
    const first = screen.getByRole("alert");

    await act(async () => {
      await current.navigate(LANDING, {
        replace: true,
        state: blockedNoticeState("annotation"),
      });
    });

    const again = screen.getByRole("alert");
    expect(again).toHaveTextContent(ANNOTATION_ZH);
    expect(again).not.toBe(first);
    await waitFor(() => {
      expect(current.state.location.state).toBeNull();
    });
  });

  it.each([{ blockedNotice: "tasks" }, { blockedNotice: 1 }, "annotation", { other: true }])(
    "draws nothing for the unknown state %j",
    async (state) => {
      await arriveBlocked(state);

      expect(await screen.findByText("Landing")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("draws nothing without state", async () => {
    open([LANDING]);

    expect(await screen.findByText("Landing")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the state with exactly one replace under StrictMode, and shows one explanation", async () => {
    const current = open(["/other"], true);
    const actions: string[] = [];
    const unsubscribe = current.subscribe((state) => {
      actions.push(`${state.historyAction} ${state.location.pathname}`);
    });

    await act(async () => {
      await current.navigate(LANDING, { state: blockedNoticeState("annotation") });
    });
    await waitFor(() => {
      expect(current.state.location.state).toBeNull();
    });
    unsubscribe();

    expect(actions).toEqual([`PUSH ${LANDING}`, `REPLACE ${LANDING}`]);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(ANNOTATION_ZH);
  });
});
