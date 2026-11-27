/**
 * The gallery's completeness test (design D10), in two layers:
 *
 * 1. at run time, the catalog's keys equal every declared value array;
 * 2. the rendered page shows one `[data-gallery-item]` per declared value, and
 *    every primitive file in src/components/ui/ has a section on the page.
 *
 * The page is imported from the dev-gallery entry, so the devGallery namespace
 * is registered the same way as at runtime (design D7).
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { alertVariantValues } from "@/components/ui/alert";
import { badgeVariantValues } from "@/components/ui/badge";
import { buttonSizeValues, buttonVariantValues } from "@/components/ui/button";
import { separatorOrientationValues } from "@/components/ui/separator";

import { renderGallery } from "./render-gallery";
import {
  blockedSampleValues,
  buttonStateValues,
  cardPartValues,
  dialogSampleValues,
  emptySampleValues,
  inputStateValues,
  labelSampleValues,
  skeletonSampleValues,
  variantCatalog,
} from "./variant-catalog";

/**
 * Primitive file -> the id of the section that shows it (design D10). This is
 * the one place to update when a primitive is added to src/components/ui/.
 */
const PRIMITIVE_SECTIONS: Record<string, string> = {
  "button.tsx": "button",
  "input.tsx": "input",
  "label.tsx": "label",
  "badge.tsx": "badge",
  "alert.tsx": "alert",
  "card.tsx": "card",
  "separator.tsx": "separator",
  "dialog.tsx": "dialog",
  "skeleton.tsx": "states",
  "empty.tsx": "states",
};

/** Every primitive source file; the primitives' own tests are excluded. */
const primitiveModules = import.meta.glob([
  "/src/components/ui/*.tsx",
  "!/src/components/ui/*.test.tsx",
]);

/** The primitives' own test files, to show they exist and are not counted. */
const primitiveTestModules = import.meta.glob("/src/components/ui/*.test.tsx");

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

const primitiveFiles = Object.keys(primitiveModules).map(fileName);

/** One declared value set: which component, which axis, which values. */
interface Declared {
  /** The component part of the item id, e.g. `button`. */
  component: string;
  /** The axis part of the item id, e.g. `variant`. */
  axis: string;
  /** The declared values, read at run time. */
  values: readonly string[];
}

const DECLARED: Declared[] = [
  { component: "button", axis: "variant", values: buttonVariantValues },
  { component: "button", axis: "size", values: buttonSizeValues },
  { component: "button", axis: "state", values: buttonStateValues },
  { component: "input", axis: "state", values: inputStateValues },
  { component: "label", axis: "sample", values: labelSampleValues },
  { component: "badge", axis: "variant", values: badgeVariantValues },
  { component: "alert", axis: "variant", values: alertVariantValues },
  { component: "card", axis: "part", values: cardPartValues },
  { component: "separator", axis: "orientation", values: separatorOrientationValues },
  { component: "dialog", axis: "sample", values: dialogSampleValues },
  { component: "skeleton", axis: "sample", values: skeletonSampleValues },
  { component: "empty", axis: "sample", values: emptySampleValues },
  { component: "blocked-screen", axis: "kind", values: blockedSampleValues },
];

function itemSelector(component: string, axis: string, value: string): string {
  return `[data-gallery-item="${component}:${axis}:${value}"]`;
}

/** Throws, naming every value of `declared` that has no item on the page. */
function assertEveryValueShown(page: HTMLElement, declared: Declared): void {
  const missing = declared.values.filter(
    (value) => page.querySelector(itemSelector(declared.component, declared.axis, value)) === null,
  );
  if (missing.length > 0) {
    throw new Error(
      `${declared.component} declares ${declared.axis} values the gallery does not show: ${missing.join(", ")}`,
    );
  }
}

/** Throws, naming every primitive file without a mapped section on the page. */
function assertEveryPrimitiveShown(page: HTMLElement, files: readonly string[]): void {
  const problems = files.flatMap((file) => {
    const sectionId = PRIMITIVE_SECTIONS[file];
    if (sectionId === undefined) {
      return [`${file} has no entry in the primitive -> section table`];
    }
    return page.querySelector(`section#${sectionId}`) === null
      ? [`${file} has no section #${sectionId} on the gallery`]
      : [];
  });
  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
}

describe("variant catalog (layer 1)", () => {
  it.each([
    ["button variant", variantCatalog.button.variant, buttonVariantValues],
    ["button size", variantCatalog.button.size, buttonSizeValues],
    ["button state", variantCatalog.button.state, buttonStateValues],
    ["input state", variantCatalog.input.state, inputStateValues],
    ["label sample", variantCatalog.label.sample, labelSampleValues],
    ["badge variant", variantCatalog.badge.variant, badgeVariantValues],
    ["alert variant", variantCatalog.alert.variant, alertVariantValues],
    ["card part", variantCatalog.card.part, cardPartValues],
    ["separator orientation", variantCatalog.separator.orientation, separatorOrientationValues],
    ["dialog sample", variantCatalog.dialog.sample, dialogSampleValues],
    ["skeleton sample", variantCatalog.skeleton.sample, skeletonSampleValues],
    ["empty sample", variantCatalog.empty.sample, emptySampleValues],
  ] as const)("has exactly the declared %s values", (_label, demos, values) => {
    expect(new Set(Object.keys(demos))).toEqual(new Set(values));
  });
});

describe("DevGalleryPage completeness (layer 2)", () => {
  it("shows one item per declared value, named by the value", () => {
    const page = renderGallery().container;

    for (const declared of DECLARED) {
      expect(() => {
        assertEveryValueShown(page, declared);
      }).not.toThrow();
    }
    for (const declared of DECLARED.filter(({ component }) => component === "button")) {
      for (const value of declared.values) {
        const item = page.querySelector(itemSelector("button", declared.axis, value));
        expect(item).toHaveTextContent(new RegExp(`^${value}$`));
        expect(screen.getByRole("button", { name: value })).toBe(item);
      }
    }
    for (const value of badgeVariantValues) {
      expect(page.querySelector(itemSelector("badge", "variant", value))).toHaveTextContent(
        new RegExp(`^${value}$`),
      );
    }
    for (const value of alertVariantValues) {
      expect(page.querySelector(itemSelector("alert", "variant", value))).toHaveTextContent(
        new RegExp(`^${value}：`),
      );
    }
    const labelSample = page.querySelector<HTMLElement>(itemSelector("label", "sample", "field"));
    expect(labelSample).not.toBeNull();
    if (labelSample !== null) {
      expect(within(labelSample).getByRole("textbox", { name: "電子郵件" })).toBeInTheDocument();
    }
    for (const value of separatorOrientationValues) {
      const sample = page.querySelector(itemSelector("separator", "orientation", value));
      expect(sample).toHaveTextContent(value);
      expect(sample?.querySelector(`[data-slot="separator"]`)).toHaveAttribute(
        "data-orientation",
        value,
      );
    }
    const inputNames = { default: "預設", invalid: "驗證錯誤", disabled: "停用" };
    for (const value of inputStateValues) {
      const item = page.querySelector<HTMLElement>(itemSelector("input", "state", value));
      expect(item).not.toBeNull();
      if (item === null) continue;
      expect(within(item).getByLabelText(inputNames[value])).toBeInTheDocument();
    }
  });

  it("derives each section's count from the declared values", () => {
    renderGallery();

    const counts = {
      Button: "variant × 6 · size × 3 · 狀態 × 2",
      Input: "狀態 × 3",
      Badge: "variant × 6",
      Alert: "variant × 4",
      Card: "header · content · footer",
      Separator: "horizontal · vertical",
      無權限與找不到: "樣本 × 3",
    };
    for (const [section, count] of Object.entries(counts)) {
      expect(within(screen.getByRole("region", { name: section })).getByText(count)).toBeVisible();
    }
  });

  it("names each of the eleven sections with an h2, in order", () => {
    renderGallery();

    const titles = [
      "Button",
      "Input",
      "Label",
      "Badge",
      "Alert",
      "Card",
      "Separator",
      "Dialog",
      "Skeleton · Empty",
      "無權限與找不到",
      "Token 對照",
    ];
    const sectionTitles = document.querySelectorAll("section[id] > div > h2");
    expect(Array.from(sectionTitles, (h) => h.textContent)).toEqual(titles);
    for (const title of titles) {
      const region = screen.getByRole("region", { name: title });
      expect(region.tagName).toBe("SECTION");
    }
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("元件展示");
  });

  it("fails and names the value when Button declares a variant the gallery lacks", () => {
    const page = renderGallery().container;

    expect(() => {
      assertEveryValueShown(page, {
        component: "button",
        axis: "variant",
        values: [...buttonVariantValues, "link"],
      });
    }).toThrow(/button declares variant values the gallery does not show: link/);
  });

  it("has a section for every primitive file", () => {
    const page = renderGallery().container;

    expect(primitiveFiles.length).toBeGreaterThan(0);
    expect(() => {
      assertEveryPrimitiveShown(page, primitiveFiles);
    }).not.toThrow();
  });

  it("fails and names the file when a primitive has no section", () => {
    const page = renderGallery().container;

    expect(() => {
      assertEveryPrimitiveShown(page, [...primitiveFiles, "foo.tsx"]);
    }).toThrow(/foo\.tsx/);
  });

  it("does not count the primitives' test files as primitives", () => {
    const testFiles = Object.keys(primitiveTestModules).map(fileName);

    expect(testFiles).toEqual(expect.arrayContaining(["button.test.tsx", "input.test.tsx"]));
    expect(primitiveFiles.filter((file) => file.endsWith(".test.tsx"))).toEqual([]);
    const page = renderGallery().container;
    expect(() => {
      assertEveryPrimitiveShown(page, primitiveFiles);
    }).not.toThrow();
  });

  it("does not show the test illustration from the artifact", () => {
    renderGallery();

    expect(screen.queryByText(/完整性測試擋下漏寫的 variant/)).not.toBeInTheDocument();
    expect(screen.queryByText(/示意/)).not.toBeInTheDocument();
  });

  it("opens a sample dialog from the Dialog section, and Esc gives focus back", async () => {
    const user = userEvent.setup();
    renderGallery();
    const section = screen.getByRole("region", { name: "Dialog" });
    const open = within(section).getByRole("button", { name: "開啟對話框" });

    await user.click(open);
    expect(screen.getByRole("dialog", { name: "對話框標題" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(open).toHaveFocus();
  });

  it("ties the invalid sample to its error message and disables the disabled one", () => {
    renderGallery();

    const invalid = screen.getByLabelText("驗證錯誤");
    expect(invalid).toHaveAttribute("aria-invalid", "true");
    expect(invalid).toHaveAccessibleDescription("這一欄的格式不正確");
    expect(invalid).toHaveValue("abc");
    expect(screen.getByLabelText("停用")).toBeDisabled();
    expect(screen.getByLabelText("停用")).toHaveValue("不能編輯");
    expect(screen.getByLabelText("預設")).toHaveAttribute("placeholder", "輸入文字");
  });
});
