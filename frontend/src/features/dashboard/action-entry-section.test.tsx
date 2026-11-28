/**
 * The three action entry cards of the no-task-role layout (spec dashboard
 * Scenario「行動入口卡文案與步驟」「行動入口卡切換語言」「三張卡的按鈕都走到模組
 * 入口頁」「缺少翻譯時不中斷互動」; design D4, D5; clarification Q3, Q8, Q9, Q12).
 */
import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { changeInterfaceLanguage, i18n } from "@/lib/i18n";
import enDashboard from "@/lib/i18n/locales/en/dashboard.json";

import { ActionEntrySection } from "./action-entry-section";

/** Renders the section inside a router, since the buttons are router links. */
function renderSection(focusOnMount = false) {
  return render(
    <MemoryRouter>
      <ActionEntrySection focusOnMount={focusOnMount} />
    </MemoryRouter>,
  );
}

/** Switches the interface to English. */
async function toEnglish(): Promise<void> {
  await act(async () => {
    await changeInterfaceLanguage("en");
  });
}

/** The three cards, each the article labelled by its title. */
function cards(): HTMLElement[] {
  return screen.getAllByRole("article");
}

/** The step names of one card, in list order. */
function stepNames(card: HTMLElement): string[] {
  const list = within(card).getByRole("list");
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("strong")?.textContent ?? "");
}

interface CardText {
  /** The h3. */
  title: string;
  /** The line under the title. */
  description: string;
  /** The three step names, in order. */
  steps: string[];
  /** The link text. */
  cta: string;
}

const ZH: CardText[] = [
  {
    title: "建立標記專案",
    description: "上傳資料、設定標籤規則、指派團隊成員。",
    steps: ["建立任務", "上傳資料", "指派人員"],
    cta: "開始建立任務",
  },
  {
    title: "進行資料標記",
    description: "查看待辦任務，完成資料標記並送出結果。",
    steps: ["開啟任務", "進行標記", "送出標記"],
    cta: "開始標記",
  },
  {
    title: "進行標記審核",
    description: "逐標記員獨立審核，直接修正結果，歧異交付仲裁。",
    steps: ["審核標記", "修正或仲裁", "完成審核"],
    cta: "開始審核",
  },
];

const EN: CardText[] = [
  {
    title: "Create Labeling Project",
    description: "Upload data, set labeling rules, and assign team members.",
    steps: ["Create Task", "Upload Data", "Assign Team"],
    cta: "Start Creating Task",
  },
  {
    title: "Conduct Data Labeling",
    description: "View pending tasks, complete data labeling, and submit results.",
    steps: ["Open Task", "Annotate", "Submit Annotation"],
    cta: "Start Annotating",
  },
  {
    title: "Conduct Labeling Review",
    description:
      "Review each annotator independently, correct results directly, and arbitrate disputes.",
    steps: ["Review Annotations", "Correct or Arbitrate", "Complete Review"],
    cta: "Start Reviewing",
  },
];

const HREFS = [
  "/task-management/task-list",
  "/annotation/annotation-list?entry=nav&role=annotator",
  "/annotation/annotation-list?entry=nav&role=reviewer",
];

/** Checks every card's title, description, step names and link text. */
function expectCards(expected: CardText[]): void {
  const found = cards();
  expect(found).toHaveLength(3);
  expected.forEach((text, index) => {
    const card = found[index];
    if (card === undefined) {
      throw new Error(`card ${String(index)} is missing`);
    }
    expect(within(card).getByRole("heading", { level: 3 })).toHaveTextContent(text.title);
    expect(card).toHaveAccessibleName(text.title);
    expect(within(card).getByText(text.description)).toBeInTheDocument();
    expect(stepNames(card)).toEqual(text.steps);
    expect(within(card).getByRole("link")).toHaveTextContent(text.cta);
  });
}

afterEach(() => {
  // Restore the full English bundle after the missing-key test.
  i18n.removeResourceBundle("en", "dashboard");
  i18n.addResourceBundle("en", "dashboard", enDashboard);
});

describe("ActionEntrySection", () => {
  it("shows the section title, its subtitle and the three cards in Chinese", () => {
    renderSection();

    const region = screen.getByRole("region", { name: "開始你的第一個工作流程" });
    expect(region).toHaveAttribute("data-testid", "user-view");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("開始你的第一個工作流程");
    expect(screen.getByText("從三個行動入口開始，快速達成第一個可交付成果")).toBeInTheDocument();
    expectCards(ZH);
  });

  it("uses 送出 for card B's description, step 3 name and step 3 description", () => {
    renderSection();

    const cardB = cards()[1];
    if (cardB === undefined) {
      throw new Error("card B is missing");
    }
    expect(within(cardB).getByText("查看待辦任務，完成資料標記並送出結果。")).toBeInTheDocument();
    expect(within(cardB).getByText("送出標記")).toBeInTheDocument();
    expect(within(cardB).getByText("自我檢查標記一致性，送出標記結果")).toBeInTheDocument();
    expect(cardB.textContent).not.toContain("提交");
  });

  it("gives every card an ordered list of three steps, each with a name and a description", () => {
    renderSection();

    for (const card of cards()) {
      const list = within(card).getByRole("list");
      expect(list.tagName).toBe("OL");
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(3);
      for (const item of items) {
        expect(item.querySelector("strong")?.textContent).not.toBe("");
        expect(item.querySelector("span")?.textContent).not.toBe("");
      }
    }
  });

  it("hides every icon from assistive technology", () => {
    const { container } = renderSection();

    const icons = container.querySelectorAll("svg");
    // Per card: one role icon, three step icons and two arrows.
    expect(icons).toHaveLength(18);
    for (const icon of Array.from(icons)) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("links each card to its module entry, never disabled", () => {
    renderSection();

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(HREFS);
    for (const link of links) {
      expect(link).not.toHaveAttribute("aria-disabled");
      expect(link).not.toHaveAttribute("disabled");
      expect(link).toHaveAttribute("data-variant", "cta");
    }
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("puts no task, task type, output type or view in any link", () => {
    renderSection();

    for (const link of screen.getAllByRole("link")) {
      const url = new URL(link.getAttribute("href") ?? "", "http://localhost");
      for (const name of ["task", "task_id", "task_type", "output_type", "view"]) {
        expect(url.searchParams.has(name)).toBe(false);
      }
    }
  });

  it("switches every text to English without remounting", async () => {
    renderSection();

    await toEnglish();

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Start Your First Workflow",
    );
    expect(
      screen.getByText("Use these three action entry points to reach your first success quickly."),
    ).toBeInTheDocument();
    expectCards(EN);
    for (const card of cards()) {
      expect(card.textContent).not.toMatch(/[一-鿿]/);
    }
  });

  it("shows the Chinese text where one English key is missing, the rest in English", async () => {
    const { leader, ...otherCards } = enDashboard.entry.cards;
    const leaderWithoutTitle = Object.fromEntries(
      Object.entries(leader).filter(([key]) => key !== "title"),
    );
    i18n.removeResourceBundle("en", "dashboard");
    i18n.addResourceBundle("en", "dashboard", {
      ...enDashboard,
      entry: { ...enDashboard.entry, cards: { ...otherCards, leader: leaderWithoutTitle } },
    });
    renderSection();

    await toEnglish();

    const [cardA, cardB, cardC] = cards();
    expect(cardA && within(cardA).getByRole("heading", { level: 3 })).toHaveTextContent(
      "建立標記專案",
    );
    expect(cardA && within(cardA).getByRole("link")).toHaveTextContent("Start Creating Task");
    expect(cardB && within(cardB).getByRole("heading", { level: 3 })).toHaveTextContent(
      "Conduct Data Labeling",
    );
    expect(cardC && within(cardC).getByRole("heading", { level: 3 })).toHaveTextContent(
      "Conduct Labeling Review",
    );
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(HREFS);
  });

  it("makes the section title programmatically focusable, and focuses it only when asked", () => {
    const { unmount } = renderSection();
    const title = screen.getByRole("heading", { level: 2 });
    expect(title).toHaveAttribute("tabindex", "-1");
    expect(title).not.toHaveFocus();
    unmount();

    renderSection(true);
    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
  });

  it("paints the role circles with the data colours, in shadowless cards", () => {
    renderSection();

    const [cardA, cardB, cardC] = cards();
    expect(cardA?.innerHTML).toContain("bg-[var(--data-role-emerald-bg)]");
    expect(cardB?.innerHTML).toContain("bg-[var(--data-role-violet-bg)]");
    expect(cardC?.innerHTML).toContain("bg-[var(--data-role-indigo-bg)]");
    for (const card of cards()) {
      expect(card).toHaveClass("shadow-none");
    }
  });
});
