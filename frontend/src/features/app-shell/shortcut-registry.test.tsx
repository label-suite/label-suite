/**
 * The shortcut list and the `?` key (sidebar-nav design D12, clarification
 * Q3; spec 07-01 §快捷鍵總覽).
 */
import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ShellViewport } from "@/components/app-shell/types";

import {
  GLOBAL_SHORTCUT_GROUP,
  shortcutGroupsFor,
  useShortcutOverviewKey,
} from "./shortcut-registry";

const REVIEW_GROUP = {
  id: "review",
  titleKey: "shortcuts.groups.review",
  shortcuts: [{ keys: ["A"], labelKey: "shortcuts.actions.approve" }],
};

describe("shortcutGroupsFor", () => {
  it("快捷鍵總覽只列目前頁面可用的: only Global, with ? and Esc, when no route declares more", () => {
    const groups = shortcutGroupsFor([{ navKey: "dashboard" }, undefined, null]);

    expect(groups).toEqual([GLOBAL_SHORTCUT_GROUP]);
    expect(GLOBAL_SHORTCUT_GROUP).toEqual({
      id: "global",
      titleKey: "shortcuts.groups.global",
      shortcuts: [
        { keys: ["?"], labelKey: "shortcuts.actions.openOverview" },
        { keys: ["Esc"], labelKey: "shortcuts.actions.closeDialog" },
      ],
    });
  });

  it("adds the groups the matched routes declare, after Global, once each", () => {
    const groups = shortcutGroupsFor([
      { shortcutGroups: [REVIEW_GROUP] },
      { navKey: "annotation", shortcutGroups: [REVIEW_GROUP] },
    ]);

    expect(groups.map((group) => group.id)).toEqual(["global", "review"]);
  });

  it("ignores a declaration that is not a list of groups", () => {
    const groups = shortcutGroupsFor([
      { shortcutGroups: "review" },
      { shortcutGroups: [{ id: "x" }, REVIEW_GROUP, 3] },
    ]);

    expect(groups.map((group) => group.id)).toEqual(["global", "review"]);
  });
});

/** Props of {@link KeyHarness}. */
interface KeyHarnessProps {
  /** The current layout. */
  viewport: ShellViewport;
  /** Called when `?` should open the overview. */
  onOpen: () => void;
}

function KeyHarness({ viewport, onOpen }: KeyHarnessProps) {
  useShortcutOverviewKey(viewport, onOpen);
  return (
    <div>
      <button type="button">Focusable</button>
      <input aria-label="Search" />
      <textarea aria-label="Note" />
      <select aria-label="Pick">
        <option>a</option>
      </select>
      <div contentEditable suppressContentEditableWarning aria-label="Rich" role="textbox">
        x
      </div>
    </div>
  );
}

describe("useShortcutOverviewKey", () => {
  it("opens on ? from 768px when focus is not in an editable field", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<KeyHarness viewport="desktop" onOpen={onOpen} />);

    await user.keyboard("?");
    screen.getByRole("button", { name: "Focusable" }).focus();
    await user.keyboard("?");

    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("手機按問號不開啟快捷鍵總覽: does nothing below 768px", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<KeyHarness viewport="mobile" onOpen={onOpen} />);

    await user.keyboard("?");

    expect(onOpen).not.toHaveBeenCalled();
  });

  it.each(["Search", "Note", "Pick", "Rich"])(
    "does nothing while focus is in the %s field",
    async (field) => {
      const user = userEvent.setup();
      const onOpen = vi.fn();
      render(<KeyHarness viewport="desktop" onOpen={onOpen} />);

      screen.getByLabelText(field).focus();
      await user.keyboard("?");

      expect(onOpen).not.toHaveBeenCalled();
    },
  );

  it("ignores other keys and ? with Ctrl, Meta or Alt", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<KeyHarness viewport="desktop" onOpen={onOpen} />);

    await user.keyboard("/{Control>}?{/Control}{Meta>}?{/Meta}{Alt>}?{/Alt}");

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("stops listening when unmounted", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const { unmount } = renderHook(() => {
      useShortcutOverviewKey("desktop", onOpen);
    });

    unmount();
    await user.keyboard("?");

    expect(onOpen).not.toHaveBeenCalled();
  });
});
