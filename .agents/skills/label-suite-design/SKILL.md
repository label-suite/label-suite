---
name: label-suite-design
description: Label Suite 的設計 token（色票、字體、字級、間距、圓角、陰影），來源是 design/prototype/assets/tokens.css。為 NoteCraft 筆記生成視覺化元件、PRD 與規格書的 tsx 骨架、或任何需要對齊 Label Suite 視覺語彙的圖表時，先讀這份；content-visualize、prd-writing、spec-writing 的視覺樣式都以它為準。
---

# Label Suite Design Tokens

唯一來源是 [`design/prototype/assets/tokens.css`](../../../design/prototype/assets/tokens.css)。本檔只整理「生成筆記元件時要用哪個值」；兩邊不一致時以 `tokens.css` 為準，並回頭更新本檔。

## 怎麼用

NoteCraft 的元件讀不到 prototype 的 CSS 變數，依用途分兩種寫法：

| 用途 | 寫法 |
|------|------|
| HTML 元素（面板、按鈕、標籤、表格） | Tailwind utility class。Label Suite 的色票都落在 Tailwind 預設色階上，直接用下表的 class |
| SVG 屬性、tsx 骨架的色票常數、傳給 three 的 WebGL 色值 | 檔內常數寫 hex，每個常數以註解標出 token 名稱，例：`const PRIMARY = "#6366F1"; // --color-primary` |

不要自創 token 以外的顏色。真的需要一個沒有的值（例如更深一階的線條），在對話中說明理由，並以最接近的 Tailwind 色階加註解。

## 色票（亮色主題）

| Token | Hex | Tailwind | 用途 |
|-------|-----|----------|------|
| `--color-primary` | `#6366F1` | `indigo-500` | 主色：主要操作、選取框、連線強調 |
| `--color-primary-strong` | `#4F46E5` | `indigo-600` | 主色文字（放在淺底上要用這個才過 WCAG AA）、選取中的填色 |
| `--color-secondary` | `#818CF8` | `indigo-400` | 次要強調 |
| `--color-primary-soft-bg` | `#EEF2FF` | `indigo-50` | 主色淺底：角色操作節點、選取列 |
| `--color-primary-border` | `#C7D2FE` | `indigo-200` | 主色細框、節點一般框線 |
| `--color-ink` | `#1E1B4B` | `indigo-950` | 內文與標題 |
| `--color-ink-muted` | `#64748B` | `slate-500` | 次要文字、說明、連線標籤 |
| `--color-surface` | `#F5F3FF` | `violet-50` | 頁面底色 |
| `--color-white` | `#FFFFFF` | `white` | 卡片底色 |
| `--color-slate-50` | `#F8FAFC` | `slate-50` | 交錯列、泳道底色 |
| `--color-border` | `#E2E8F0` | `slate-200` | 分隔線、外框 |
| `--color-border-muted` | `#F1F5F9` | `slate-100` | 更淡的分隔 |
| `--color-cta` | `#047857` | `emerald-700` | 確認、完成類的主要按鈕 |
| `--color-success` / `-bg` / `-border` | `#15803D` / `#F0FDF4` / `#BBF7D0` | `green-700` / `green-50` / `green-200` | 成功狀態 |
| `--color-warning` / `-bg` / `-border` | `#A16207` / `#FEFCE8` / `#FEF08A` | `yellow-700` / `yellow-50` / `yellow-200` | 例外、替代流程、待確認 |
| `--color-error` / `-bg` / `-border` | `#B91C1C` / `#FEF2F2` / `#FECACA` | `red-700` / `red-50` / `red-200` | 錯誤、阻擋 |
| `--color-info` / `-bg` / `-border` | `#1D4ED8` / `#EFF6FF` / `#BFDBFE` | `blue-700` / `blue-50` / `blue-200` | 資訊提示 |

`--color-text-muted` 是 `--color-ink-muted` 的舊別名，新元件不要用。暗色主題的值在 `tokens.css` 的 `html[data-theme="dark"]` 區塊；筆記元件目前以亮色為準。

### 區分多個模組或角色

圖中需要用顏色區分模組或角色時，依序取：`--color-primary`、`--color-cta`、`--color-info`、`--color-file-markdown`（`#8B5CF6`，violet-500）、`--color-secondary`；不屬於任何模組的用 `--color-ink-muted`。
`--color-warning` 與 `--color-error` 保留給例外、待確認與錯誤，不當區分色。超過五種就靠標籤文字區分，不要再加顏色。PRD 圖的模組色表見 `prd-writing/references/visualize.md`。

## 字體

| Token | 字族 | 用途 |
|-------|------|------|
| `--font-sans` | `'Inter', 'Noto Sans TC', 'PingFang TC', -apple-system, sans-serif` | 介面與圖內文字（SVG `fontFamily` 用這組） |
| `--font-serif-display` | `'Crimson Pro', 'Noto Serif TC', 'Source Han Serif TC', Georgia, serif` | 大標題；圖內不用 |
| `--font-sans-reading` | `'Atkinson Hyperlegible', 'Noto Sans TC', 'PingFang TC', sans-serif` | 標註員閱讀的長文本 |
| `--font-mono` | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace` | 代碼、ID |

## 字級、間距、圓角、陰影

- 字級：display 48、h1 36、h2 24、h3 18、body 16、caption 14、label 12（px）。圖內文字用 12–14。
- 行高：中文內文 1.8，英文內文 1.6。
- 間距：4、8、16、24、32、48、64（px），對應 Tailwind `1`、`2`、`4`、`6`、`8`、`12`、`16`。
- 圓角：sm 4、md 8、lg 12、xl 16、full 9999（px），對應 Tailwind `rounded`、`rounded-lg`、`rounded-xl`、`rounded-2xl`、`rounded-full`。
- 陰影：卡片用 `--shadow-card`（`0 4px 24px rgba(99, 102, 241, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06)`）；圖內元素不加陰影。
- 動態：`--ease-standard` 為 `cubic-bezier(0.4, 0, 0.2, 1)`，時長 150ms 或 200ms。

## 無障礙

- 放在淺底上的主色文字用 `--color-primary-strong`，不要用 `--color-primary`（對比不足 4.5:1）。
- 次要文字最淺到 `--color-ink-muted`；`slate-400` 以下的顏色不可用於文字。
