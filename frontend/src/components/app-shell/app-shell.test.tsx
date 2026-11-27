/**
 * The signed-in shell's view layer (sidebar-nav tasks 1.6; design D1, D8, D9,
 * D13, D14; ui-design §元件樹, §互動與鍵盤, §響應式, §無障礙). Everything the
 * shell shows arrives through props; these tests hand it what the navigation
 * model will and check what a user sees and can do.
 */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { changeInterfaceLanguage, i18n } from "@/lib/i18n";
import enAppShell from "@/lib/i18n/locales/en/appShell.json";

import { AppShell, type AppShellProps } from "./app-shell";
import type { ShellNavItem, ShellShortcutGroup } from "./types";

const DASHBOARD: ShellNavItem = {
  key: "dashboard",
  labelKey: "nav.dashboard",
  href: "/dashboard/dashboard",
  current: true,
};

const TASK_MANAGEMENT: ShellNavItem = {
  key: "taskManagement",
  labelKey: "nav.taskManagement",
  href: "/task-management/task-list",
  current: false,
};

const ANNOTATION: ShellNavItem = {
  key: "annotation",
  labelKey: "nav.annotation",
  href: "/annotation/annotation-list?entry=nav",
  current: false,
};

const DATASET: ShellNavItem = {
  key: "datasetAnalysis",
  labelKey: "nav.datasetAnalysis",
  href: "/dataset/dataset-analysis-list",
  current: false,
};

const PROFILE: ShellNavItem = {
  key: "profile",
  labelKey: "nav.profile",
  href: "/account/profile",
  current: false,
};

/** System Administration with its two submenu entries. */
const SYSTEM_ADMIN: ShellNavItem = {
  key: "systemAdmin",
  labelKey: "nav.systemAdmin",
  href: "/admin/user-management",
  current: false,
  children: [
    {
      key: "userManagement",
      labelKey: "adminNav.userManagement",
      href: "/admin/user-management",
      current: false,
    },
    {
      key: "roleSettings",
      labelKey: "adminNav.roleSettings",
      href: "/admin/role-settings",
      current: false,
    },
  ],
};

/** A platform member's five items, on the dashboard. */
const MEMBER_ITEMS: readonly ShellNavItem[] = [
  DASHBOARD,
  TASK_MANAGEMENT,
  ANNOTATION,
  DATASET,
  PROFILE,
];

/** A system admin's six items, on the dashboard. */
const ADMIN_ITEMS: readonly ShellNavItem[] = [
  DASHBOARD,
  TASK_MANAGEMENT,
  ANNOTATION,
  DATASET,
  SYSTEM_ADMIN,
  PROFILE,
];

/** The one group every page has (clarification Q3). */
const GLOBAL_GROUP: ShellShortcutGroup = {
  id: "global",
  titleKey: "shortcuts.groups.global",
  shortcuts: [
    { keys: ["?"], labelKey: "shortcuts.actions.openOverview" },
    { keys: ["Esc"], labelKey: "shortcuts.actions.closeDialog" },
  ],
};

/** Props of {@link ShellHarness}: any AppShell prop, plus the starting collapsed state. */
interface ShellHarnessProps extends Partial<
  Omit<AppShellProps, "collapsed" | "shortcutsOpen" | "onShortcutsOpenChange" | "children">
> {
  /** Start collapsed. */
  initiallyCollapsed?: boolean;
  /** Start with the shortcut overview open, as the `?` key would. */
  initiallyOpen?: boolean;
}

/** Renders AppShell in a router, holding the collapsed and overview state itself. */
function ShellHarness({
  initiallyCollapsed = false,
  initiallyOpen = false,
  onToggleCollapsed,
  ...props
}: ShellHarnessProps) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <MemoryRouter initialEntries={["/dashboard/dashboard"]}>
      <AppShell
        viewport="desktop"
        navItems={MEMBER_ITEMS}
        brandHref="/dashboard/dashboard"
        profileHref="/account/profile"
        user={{ name: "王小明", email: "user@example.com", roleLabelKey: "role.generalUser" }}
        shortcutGroups={[GLOBAL_GROUP]}
        signingOut={false}
        onSignOut={vi.fn()}
        {...props}
        collapsed={collapsed}
        onToggleCollapsed={() => {
          onToggleCollapsed?.();
          setCollapsed((value) => !value);
        }}
        shortcutsOpen={open}
        onShortcutsOpenChange={setOpen}
      >
        <p>Page content</p>
      </AppShell>
    </MemoryRouter>
  );
}

function mainNav(name = "主導覽"): HTMLElement {
  return screen.getByRole("navigation", { name });
}

/** The main navigation's top-level links and buttons, in order. */
function navControls(name = "主導覽"): HTMLElement[] {
  return Array.from(mainNav(name).querySelectorAll<HTMLElement>("a, button")).filter(
    (element) => element.closest('[data-testid="admin-nav-submenu"]') === null,
  );
}

/** The names of the main navigation's top-level controls, in order. */
function navNames(name = "主導覽"): string[] {
  return navControls(name).map((element) => element.textContent);
}

/** Every element in the document marked as the current page. */
function currentPages(): Element[] {
  return Array.from(document.querySelectorAll('[aria-current="page"]'));
}

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe("AppShell items and current location", () => {
  it("平台成員看不到系統管理: five items in order, no System Administration", () => {
    render(<ShellHarness />);

    expect(navNames()).toEqual(["儀表板", "任務管理", "標記作業", "資料集分析", "個人設定"]);
    expect(screen.queryByRole("button", { name: "系統管理" })).toBeNull();
    expect(screen.queryByRole("link", { name: "系統管理" })).toBeNull();
  });

  it("系統管理員看到系統管理: six items, System Administration before Profile", () => {
    render(<ShellHarness navItems={ADMIN_ITEMS} />);

    expect(navNames()).toEqual([
      "儀表板",
      "任務管理",
      "標記作業",
      "資料集分析",
      "系統管理",
      "個人設定",
    ]);
  });

  it("links every item to the target it is given, the third one without task data", () => {
    render(<ShellHarness />);

    expect(screen.getByRole("link", { name: "儀表板" })).toHaveAttribute(
      "href",
      "/dashboard/dashboard",
    );
    expect(screen.getByRole("link", { name: "標記作業" })).toHaveAttribute(
      "href",
      "/annotation/annotation-list?entry=nav",
    );
  });

  it("每頁只有一個目前位置: exactly one aria-current page, also when collapsed", async () => {
    const user = userEvent.setup();
    render(<ShellHarness navItems={ADMIN_ITEMS} />);

    expect(currentPages()).toEqual([screen.getByRole("link", { name: "儀表板" })]);

    await user.click(screen.getByRole("button", { name: "收合側欄" }));

    const dashboard = screen.getByRole("link", { name: "儀表板" });
    expect(currentPages()).toEqual([dashboard]);
    expect(dashboard.querySelector("svg")).not.toBeNull();
  });

  it("reports a plain click on an item to the composition layer", async () => {
    const user = userEvent.setup();
    const onNavClick = vi.fn<NonNullable<AppShellProps["onNavClick"]>>();
    render(<ShellHarness onNavClick={onNavClick} />);

    await user.click(screen.getByRole("link", { name: "標記作業" }));

    expect(onNavClick).toHaveBeenCalledTimes(1);
    expect(onNavClick.mock.calls[0]?.[0]).toMatchObject({ key: "annotation" });
  });
});

describe("AppShell desktop layout", () => {
  it("has the brand link, language switch, tools, user summary and sign-out, and no notifications", () => {
    render(<ShellHarness />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Label Suite 首頁" })).toHaveAttribute(
      "href",
      "/dashboard/dashboard",
    );
    expect(screen.getByTestId("lang-toggle")).toHaveAccessibleName("ZH，切換語言");
    const tools = screen.getByRole("group", { name: "全域工具" });
    expect(within(tools).getByRole("button", { name: "快捷鍵" })).toHaveAttribute(
      "data-testid",
      "shortcut-help-button",
    );
    expect(within(tools).getByRole("button", { name: "切換為深色模式" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前往個人設定" })).toHaveAttribute(
      "href",
      "/account/profile",
    );
    expect(screen.getByRole("button", { name: "登出" })).toBeInTheDocument();
    expect(screen.getByText("Page content").closest("main")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /通知|Notifications/ })).toBeNull();
  });

  it("沒有任務角色時角色標示讀作一般使用者: the name and the role label, never the system role", () => {
    render(<ShellHarness />);

    const profile = screen.getByRole("link", { name: "前往個人設定" });
    expect(within(profile).getByText("王小明")).toBeInTheDocument();
    expect(within(profile).getByTestId("role-indicator")).toHaveTextContent("一般使用者");
    expect(within(profile).getByText("王", { selector: "[aria-hidden]" })).toBeInTheDocument();
    expect(screen.queryByText("平台成員")).toBeNull();
    expect(screen.queryByText("user@example.com")).toBeNull();
  });

  it("shows the email and its first letter when the name is empty", () => {
    render(
      <ShellHarness
        user={{ name: "", email: "ada@example.com", roleLabelKey: "role.generalUser" }}
      />,
    );

    const profile = screen.getByRole("link", { name: "前往個人設定" });
    expect(within(profile).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(profile).getByText("A", { selector: "[aria-hidden]" })).toBeInTheDocument();
  });

  it("shows U when the name and email are only zero-width characters", () => {
    render(<ShellHarness user={{ name: "​‌", email: "﻿", roleLabelKey: "role.generalUser" }} />);

    const profile = screen.getByRole("link", { name: "前往個人設定" });
    expect(within(profile).getByText("U", { selector: "[aria-hidden]" })).toBeInTheDocument();
  });

  it("walks the controls in the specified Tab order", async () => {
    const user = userEvent.setup();
    render(<ShellHarness navItems={ADMIN_ITEMS} />);
    const expected = [
      screen.getByRole("link", { name: "Label Suite 首頁" }),
      screen.getByTestId("lang-toggle"),
      ...navControls(),
      screen.getByRole("button", { name: "收合側欄" }),
      screen.getByRole("button", { name: "快捷鍵" }),
      screen.getByRole("button", { name: "切換為深色模式" }),
      screen.getByRole("link", { name: "前往個人設定" }),
      screen.getByRole("button", { name: "登出" }),
    ];
    expect(expected).toHaveLength(13);

    const visited: Element[] = [];
    for (let step = 0; step < expected.length; step += 1) {
      await user.tab();
      if (document.activeElement !== null) visited.push(document.activeElement);
    }

    expect(visited).toEqual(expected);
  });
});

describe("AppShell collapse", () => {
  it("names the collapse control after what it does and points it at the sidebar", async () => {
    const user = userEvent.setup();
    render(<ShellHarness />);
    const control = screen.getByRole("button", { name: "收合側欄" });
    expect(control).toHaveAttribute("aria-expanded", "true");
    expect(control).toHaveAttribute("aria-controls", screen.getByRole("banner").id);

    control.focus();
    await user.keyboard("{Enter}");

    const expand = screen.getByRole("button", { name: "展開側欄" });
    expect(expand).toBe(control);
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "收合側欄" })).toHaveFocus();
  });

  it("側欄收合後快捷鍵入口隱藏: hides the shortcut entry, language switch and name, keeps theme and sign-out", async () => {
    const user = userEvent.setup();
    render(<ShellHarness />);

    await user.click(screen.getByRole("button", { name: "收合側欄" }));

    expect(screen.queryByRole("button", { name: "快捷鍵" })).toBeNull();
    expect(screen.queryByTestId("lang-toggle")).toBeNull();
    expect(screen.queryByText("王小明")).toBeNull();
    expect(screen.queryByRole("link", { name: "前往個人設定" })).toBeNull();
    expect(screen.getByRole("button", { name: "切換為深色模式" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登出" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /通知|Notifications/ })).toBeNull();
  });

  it("keeps the items' names when collapsed, the text only visually hidden", async () => {
    const user = userEvent.setup();
    render(<ShellHarness />);

    await user.click(screen.getByRole("button", { name: "收合側欄" }));

    const dashboard = screen.getByRole("link", { name: "儀表板" });
    expect(dashboard).toHaveAttribute("title", "儀表板");
    expect(within(dashboard).getByText("儀表板")).toHaveClass("sr-only");
  });

  it("點擊側欄空白區收合: a click on the sidebar's empty space toggles it", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ShellHarness onToggleCollapsed={onToggle} />);

    await user.click(screen.getByRole("banner"));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "展開側欄" })).toBeInTheDocument();
  });

  it("點擊導覽連結、登出、語言與外觀不會收合", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ShellHarness onToggleCollapsed={onToggle} navItems={ADMIN_ITEMS} />);

    await user.click(screen.getByRole("link", { name: "儀表板" }));
    await user.click(screen.getByRole("button", { name: "登出" }));
    await user.click(screen.getByRole("button", { name: "切換為深色模式" }));
    await user.click(screen.getByRole("button", { name: "系統管理" }));
    await user.click(screen.getByTestId("lang-toggle"));

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /收合側欄|Collapse sidebar/ })).toBeInTheDocument();
  });

  it("關閉動態效果時不播動畫: every transition stops under reduced motion", async () => {
    const user = userEvent.setup();
    render(<ShellHarness navItems={ADMIN_ITEMS} />);
    await user.click(screen.getByRole("button", { name: "系統管理" }));
    expect(screen.getByRole("link", { name: "角色設定" }).getAttribute("class")).toContain(
      "transition-colors",
    );

    const animated = Array.from(document.querySelectorAll("[class*='transition']"));
    expect(animated.length).toBeGreaterThan(0);
    expect(screen.getByRole("banner").getAttribute("class")).toMatch(/transition-\[width/);
    // Both: transition-none drops the property, duration-0 makes the computed
    // transition-duration 0s, which is what the Scenario measures.
    for (const element of animated) {
      const classes = element.getAttribute("class") ?? "";
      expect(classes, element.outerHTML.slice(0, 80)).toContain("motion-reduce:transition-none");
      expect(classes, element.outerHTML.slice(0, 80)).toContain("motion-reduce:duration-0");
    }
  });
});

describe("AppShell System Administration submenu (disclosure, design D13)", () => {
  it("展開系統管理次選單: opens exactly the two links", async () => {
    const user = userEvent.setup();
    render(<ShellHarness navItems={ADMIN_ITEMS} />);
    const trigger = screen.getByRole("button", { name: "系統管理" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("data-testid", "admin-nav-trigger");
    expect(screen.queryByRole("link", { name: "使用者管理" })).toBeNull();

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const submenu = screen.getByTestId("admin-nav-submenu");
    expect(trigger).toHaveAttribute("aria-controls", submenu.id);
    expect(
      within(submenu)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/admin/user-management", "/admin/role-settings"]);
    expect(within(submenu).getByRole("link", { name: "使用者管理" })).toHaveAttribute(
      "data-testid",
      "admin-nav-user-management-link",
    );
    expect(within(submenu).getByRole("link", { name: "角色設定" })).toHaveAttribute(
      "data-testid",
      "admin-nav-role-settings-link",
    );
    expect(submenu).not.toHaveAttribute("role", "menu");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("按 Esc 關閉系統管理次選單: closes and gives focus back to the trigger", async () => {
    const user = userEvent.setup();
    render(<ShellHarness navItems={ADMIN_ITEMS} />);
    const trigger = screen.getByRole("button", { name: "系統管理" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.tab();
    await user.tab();
    expect(screen.getByRole("link", { name: "角色設定" })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("link", { name: "角色設定" })).toBeNull();
  });

  it("closes when the pointer goes down outside it", async () => {
    const user = userEvent.setup();
    render(<ShellHarness navItems={ADMIN_ITEMS} />);
    const trigger = screen.getByRole("button", { name: "系統管理" });
    await user.click(trigger);

    await user.click(screen.getByText("Page content"));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("is a plain link to User Management when collapsed, and closes on collapse", async () => {
    const user = userEvent.setup();
    render(<ShellHarness navItems={ADMIN_ITEMS} />);
    await user.click(screen.getByRole("button", { name: "系統管理" }));

    await user.click(screen.getByRole("button", { name: "收合側欄" }));

    expect(screen.queryByRole("button", { name: "系統管理" })).toBeNull();
    expect(screen.getByRole("link", { name: "系統管理" })).toHaveAttribute(
      "href",
      "/admin/user-management",
    );
    expect(screen.queryByTestId("admin-nav-submenu")).toBeNull();

    await user.click(screen.getByRole("button", { name: "展開側欄" }));
    expect(screen.getByRole("button", { name: "系統管理" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

describe("AppShell shortcut overview", () => {
  it("opens from the entry, lists only the groups it is given, and Esc gives focus back", async () => {
    const user = userEvent.setup();
    render(<ShellHarness />);
    const entry = screen.getByRole("button", { name: "快捷鍵" });

    await user.click(entry);

    const dialog = screen.getByRole("dialog", { name: "目前頁面可用快捷鍵" });
    expect(
      within(dialog)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["全域"]);
    expect(
      within(dialog)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual(["開啟快捷鍵總覽", "關閉視窗或取消選取"]);
    expect(
      within(dialog)
        .getAllByRole("definition")
        .map((d) => d.textContent),
    ).toEqual(["?", "Esc"]);
    expect(within(dialog).queryByText(/審核|工作區|頁籤/)).toBeNull();
    expect(within(dialog).getByRole("button", { name: "關閉快捷鍵" })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(entry).toHaveFocus();
  });

  it("returns focus to the element focused before an outside opening", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OpenFromOutside open={false} />);
    const dashboard = screen.getByRole("link", { name: "儀表板" });
    dashboard.focus();

    rerender(<OpenFromOutside open />);
    expect(screen.getByRole("dialog", { name: "目前頁面可用快捷鍵" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(dashboard).toHaveFocus();
  });
});

/** Props of {@link OpenFromOutside}. */
interface OpenFromOutsideProps {
  /** Whether the composition layer wants the overview open. */
  open: boolean;
}

/** The shell with its overview opened by a prop, the way the `?` key will open it. */
function OpenFromOutside({ open }: OpenFromOutsideProps) {
  const [closed, setClosed] = useState(false);
  return (
    <MemoryRouter>
      <AppShell
        viewport="desktop"
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        navItems={MEMBER_ITEMS}
        brandHref="/dashboard/dashboard"
        profileHref="/account/profile"
        user={{ name: "王小明", email: "user@example.com", roleLabelKey: "role.generalUser" }}
        shortcutGroups={[GLOBAL_GROUP]}
        shortcutsOpen={open && !closed}
        onShortcutsOpenChange={(next) => {
          setClosed(!next);
        }}
        signingOut={false}
        onSignOut={vi.fn()}
      >
        <p>Page content</p>
      </AppShell>
    </MemoryRouter>
  );
}

describe("AppShell sign-out", () => {
  it("asks the composition layer to sign out", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(<ShellHarness onSignOut={onSignOut} />);

    await user.click(screen.getByRole("button", { name: "登出" }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("等待中的操作顯示進行中: aria-busy while signing out, and no second request", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(<ShellHarness signingOut onSignOut={onSignOut} />);

    const button = screen.getByRole("button", { name: "登出" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);

    expect(onSignOut).not.toHaveBeenCalled();
  });
});

describe("AppShell on a phone", () => {
  it("手機能完整導覽: a top brand bar and a bottom navigation, no name, no shortcut entry, no collapse", () => {
    render(<ShellHarness viewport="mobile" />);

    const brandLink = screen.getByRole("link", { name: "Label Suite 首頁" });
    const bar = brandLink.parentElement;
    expect(bar).not.toBeNull();
    if (bar !== null) {
      expect(within(bar).getByTestId("lang-toggle")).toHaveAttribute("data-size", "compact");
      expect(within(bar).getByRole("button", { name: "切換為深色模式" })).toHaveAttribute(
        "data-testid",
        "mobile-theme-toggle",
      );
      expect(within(bar).getByRole("button", { name: "登出" })).toBeInTheDocument();
    }
    expect(navNames()).toEqual(["儀表板", "任務管理", "標記作業", "資料集分析", "個人設定"]);
    expect(screen.queryByText("王小明")).toBeNull();
    expect(screen.queryByRole("button", { name: "快捷鍵" })).toBeNull();
    expect(screen.queryByRole("button", { name: /收合側欄|展開側欄/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /切換為(深|淺)色模式/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "登出" })).toHaveLength(1);
  });

  it("手機不啟用收合: a remembered collapse is ignored and a click on the bar toggles nothing", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ShellHarness viewport="mobile" initiallyCollapsed onToggleCollapsed={onToggle} />);

    await user.click(mainNav());

    expect(onToggle).not.toHaveBeenCalled();
    for (const link of within(mainNav()).getAllByRole("link")) {
      expect(link.querySelector(".sr-only")).toBeNull();
    }
  });

  it("lets long labels wrap inside their item, hyphenating by syllable first (Q13)", () => {
    render(<ShellHarness viewport="mobile" navItems={ADMIN_ITEMS} />);

    for (const item of navControls()) {
      expect(item).toHaveClass(
        "whitespace-normal",
        "hyphens-auto",
        "[overflow-wrap:anywhere]",
        "text-center",
      );
      expect(item).not.toHaveClass("whitespace-nowrap");
    }
  });

  it("shows the soft-hyphenated English labels on a phone, named without the hyphens (Q13)", async () => {
    render(<ShellHarness viewport="mobile" navItems={ADMIN_ITEMS} />);

    await act(async () => {
      await changeInterfaceLanguage("en");
    });

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(navControls("Main navigation").map((item) => item.textContent)).toEqual([
      "Dash\u00ADboard",
      "Task Man\u00ADage\u00ADment",
      "Anno\u00ADta\u00ADtion",
      "Data\u00ADset Ana\u00ADlyt\u00ADics",
      "Sys\u00ADtem Admin\u00ADis\u00ADtra\u00ADtion",
      "Profile",
    ]);
    for (const name of [
      "Dashboard",
      "Task Management",
      "Annotation",
      "Dataset Analytics",
      "System Administration",
      "Profile",
    ]) {
      const link = within(nav).getByRole("link", { name });
      expect(link).toHaveAttribute("title", name);
    }
  });

  it("keeps the plain labels on the desktop sidebar", async () => {
    render(<ShellHarness navItems={ADMIN_ITEMS} />);

    await act(async () => {
      await changeInterfaceLanguage("en");
    });

    for (const item of navControls("Main navigation")) {
      expect(item.textContent).not.toContain("\u00AD");
    }
  });

  it("keeps the desktop items as they were: no forced word breaks", () => {
    render(<ShellHarness navItems={ADMIN_ITEMS} />);

    for (const item of navControls()) {
      expect(item).not.toHaveClass("[overflow-wrap:anywhere]");
      expect(item).not.toHaveClass("hyphens-auto");
    }
  });

  it("makes System Administration a plain link to User Management", () => {
    render(<ShellHarness viewport="mobile" navItems={ADMIN_ITEMS} />);

    expect(screen.getByRole("link", { name: "系統管理" })).toHaveAttribute(
      "href",
      "/admin/user-management",
    );
    expect(screen.queryByRole("button", { name: "系統管理" })).toBeNull();
  });
});

describe("AppShell in English", () => {
  it("切換語言後整頁一起換: every name and label follows the language", async () => {
    render(<ShellHarness />);

    await act(async () => {
      await changeInterfaceLanguage("en");
    });

    expect(navNames("Main navigation")).toEqual([
      "Dashboard",
      "Task Management",
      "Annotation",
      "Dataset Analytics",
      "Profile",
    ]);
    expect(screen.getByRole("group", { name: "Global tools" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Label Suite home" })).toBeInTheDocument();
    const profile = screen.getByRole("link", { name: "Go to Profile" });
    expect(within(profile).getByTestId("role-indicator")).toHaveTextContent("General user");
  });

  it("術語缺少翻譯時顯示備用文字: a missing English name shows the Chinese one, never the key", async () => {
    const user = userEvent.setup();
    const onNavClick = vi.fn();
    const nav = Object.fromEntries(
      Object.entries(enAppShell.nav).filter(([key]) => key !== "taskManagement"),
    );
    i18n.removeResourceBundle("en", "appShell");
    i18n.addResourceBundle("en", "appShell", { ...enAppShell, nav });
    try {
      render(<ShellHarness onNavClick={onNavClick} />);
      await act(async () => {
        await changeInterfaceLanguage("en");
      });

      expect(navNames("Main navigation")).toEqual([
        "Dashboard",
        "任務管理",
        "Annotation",
        "Dataset Analytics",
        "Profile",
      ]);
      expect(document.body.textContent).not.toMatch(/nav\.taskManagement/);
      await user.click(screen.getByRole("link", { name: "任務管理" }));
      expect(onNavClick).toHaveBeenCalledTimes(1);
    } finally {
      i18n.removeResourceBundle("en", "appShell");
      i18n.addResourceBundle("en", "appShell", enAppShell);
    }
  });
});
