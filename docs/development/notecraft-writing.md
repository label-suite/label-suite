---
title: NoteCraft 文件撰寫規範與語法速查
description: docs/ 底下 NoteCraft 文件的撰寫規範、內部連結與錨點規則，以及常用語法。
tags: [notecraft, docs]
---

# NoteCraft 文件撰寫規範與語法速查

專案文件由 NoteCraftApp 呈現：notesDir 是 `docs/`，生成元件放在專案根的 `.notecraft/components/`（不是 `docs/.notecraft/`）。
NoteCraft 需要 Node 22 以上。預覽 `pnpm docs:serve`（http://127.0.0.1:4330/），驗證 `pnpm exec notecraftapp build docs`；
只改了 `.notecraft/components/` 的元件時，快取不會察覺，要改跑 `pnpm exec notecraftapp build --rebuild docs`。
規格檔另跑 `pnpm check:specs`。不在本專案跑 `tsc` 或 `astro build`。

視覺化標記與生成元件的規範見 [notecraft-visualize.md](notecraft-visualize.md)。

## 撰寫規範

- 一律放在 `docs/` 底下，依主題分資料夾；slug ＝ 相對 `docs/` 的路徑去副檔名
- 有互動元件用 `.mdx`，純文字可用 `.md`；檔名 kebab-case 英文
- frontmatter 選用，建議至少寫 `title`、`description`、`tags`

  ```yaml
  ---
  title: 使用者管理
  description: 系統管理員邀請、停用使用者與調整系統角色的規則。
  tags: [規格, 系統管理]
  createdAt: "2026-11-04"
  updatedAt: "2026-11-04"
  ---
  ```

- 圖片與筆記互連都用**相對路徑**：`![說明](../assets/illustrations/x.svg)`、`[另一篇](../specs/00-prd.mdx)`
- 指到其他段落時用內部連結，不要只寫「見某某章節」讓讀者自己找，寫法見「內部連結與錨點」
- 不使用 emoji；語意標示用 badge、Admonition 或元件內的 lucide icon
- 中文語境的冒號用全形「：」：半形冒號緊接文字（如 `風險:需求`）可能被 remark-directive 當成指令
- MDX 會把 `{` `}` 當成 JSX 運算式；內文要出現大括號時寫成 `\{` `\}`，或放進行內程式碼

## 內部連結與錨點

每個 `##`～`####` 標題都會產生錨點，用一般的 Markdown 連結就能跳轉：

```md
同一頁：見 [§卡控機制](#卡控機制)
其他頁：見 [使用者管理的卡控](../06-admin/01-user-management.mdx#卡控機制)
```

**錨點怎麼產生**：取標題文字，英文轉小寫、空白換成 `-`，標點符號（含全形的「，」「（）」「、」「。」「？」）全部拿掉，中文保留。

| 標題 | 錨點 |
| :--- | :--- |
| `## 卡控機制` | `#卡控機制` |
| `## 邊界情況（Edge Case）` | `#邊界情況edge-case` |
| `### Q1. 停用後的任務指派？（已定案，2026-11-04）` | `#q1-停用後的任務指派已定案2026-11-04` |

- 只連到**名稱固定**的標題；標題含日期、狀態或會改寫的問句時，錨點會跟著變，改連到它的上一層標題
- 粗體條列、表格列沒有錨點，連到所屬的標題
- 跨頁連結用相對路徑並保留副檔名（`.mdx`／`.md`），和筆記互連的規則相同
- 改標題文字時，用 Grep 找 `#舊錨點` 一併更新；build 不會檢查錨點是否存在，要自己確認
- 只在 `docs/` 的 NoteCraft 文件這樣寫；`openspec/` 等其他目錄的文件不是 NoteCraft 呈現，維持純文字引用

## Admonition

類型：`note`、`info`、`tip`、`success`、`warning`、`danger`

```md
:::warning{title="自訂標題"}
內容。也可寫 :::warning[自訂標題]
:::

:::tip{collapsible}
預設收合；加 open 則預設展開：{collapsible open}
:::
```

## 螢光標示與上標

MDX 可以直接寫 `<mark>`、`<sup>`，段落、清單與表格儲存格裡都能用；`<sup>` 裡可以放 Markdown 連結。

```mdx
系統角色：<mark>系統管理員、一般使用者</mark><sup>[#12](https://github.com/label-suite/label-suite/issues/12)</sup>
```

- `<mark>` 只能包行內文字，不能包住整個清單或表格
- 規格書的變更標示規則見 `.claude/skills/spec-writing/references/writing-guide.md`「需求變更」

## Tabs、Tooltip、Badge

外層冒號要比內層多一個：

```md
::::tabs
:::tab{label="標註員"}
內容 A
:::
:::tab{label="審核員"}
內容 B
:::
::::

:tip[IAA]{content="標註者間一致性，衡量多位標註員對同一筆資料的判斷有多一致。"}

:badge[待確認]{variant="warning" size="sm" outline}
:badge[文件]{variant="neutral" icon="note" href="https://example.com/"}
```

- badge `variant`：`note`、`info`、`tip`、`success`、`warning`、`danger`、`neutral`（預設）；`size`：`sm`、`md`
- badge `icon`：`sparkle`、`check`、`star`、`bolt`、`flag`、`info`、`warning`、`danger`、`note`、`success`

## Steps

```md
::::steps{layout="horizontal" start=1}
:::step{title="規劃" status="done"}
說明
:::
:::step{title="實作" status="current"}
說明
:::
::::
```

- `layout`：`vertical`（預設）、`horizontal`（窄螢幕自動轉直式）；`status`：`done`、`current`、`todo`
- step 內要放 Admonition 時，外層各多加一個冒號（`:::::steps` > `::::step` > `:::tip`）

## 程式碼區塊

````md
```ts title="frontend/src/main.ts" {2,5-6}
// title 顯示檔名；{} 為 1-indexed 行高亮
```
````

Code annotations：程式碼中 `(n)!` 對應下方編號清單，數量要一致，整段包在 `:::annotate` 內。

## 定義與引用（define／include／ref）

```md
:::define{id="term.annotator" label="標註員"}
<strong>標註員</strong>：被指派到任務、負責標註資料的使用者。
:::

::include{id="term.annotator"}

由 :ref[標註員]{id="term.annotator"} 完成標註。
```

- `define` 只能放最上層，不可放進 tabs／steps；內含容器時冒號要比內層多
- id 用字母、數字、`_`、`-`，以 `.` 分段，全站不可重複；找不到或重複會讓 build 失敗
- `::include` 單獨一行、最多嵌套 4 層；`define` 內不能有 `import`／`export`
- 業務名詞的定義集中在 `docs/specs/glossary.mdx`（id 以 `term.` 開頭）；模組地圖是 `docs/specs/index.mdx` 的 `specs.module-map`

## PluginView 與系列

- 嵌入 plugin 資料檔：`<PluginView src="path/to/data.er.json" />`
- 系列閱讀路徑：`.notecraft/series.json`，`slugs` 為相對 `docs/` 的路徑去副檔名（資料檔寫 `view:<路徑>`）

```json
{
  "series": [
    {
      "id": "specs",
      "title": "規格書",
      "eyebrow": "SDD",
      "description": "從 PRD 到各頁面規格的閱讀路徑。",
      "accent": "blue",
      "icon": "layers",
      "slugs": ["specs/00-prd", "specs/06-admin/01-user-management"]
    }
  ]
}
```

`accent`：`blue`、`orange`、`navy`；`icon`：`target`、`code`、`layers`、`bookOpen`、`bolt`
