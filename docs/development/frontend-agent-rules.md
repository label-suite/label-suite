---
title: '前端開發規範'
description: '分層與允許 import、型別安全、Hooks、狀態的三個去處、重用與不過度抽象、design token 的映射、圖示與 SVG、四種畫面狀態與表單、無障礙最低要求、日期與時區、註解與 JSDoc。附來源逐條對照。'
category: '開發說明'
tags: [開發說明, Agent, 規範, 前端]
createdAt: '2026-11-10'
updatedAt: '2026-11-10'
---

# 前端開發規範

:badge[Issue #109]{variant="neutral"} :badge[正式開發前]{variant="warning"}

> `AGENTS.md` 是**規則本體**。這一份是前端那一塊的說明，由 `AGENTS.md` 的 Agent Rules Index 指過來。
> 兩邊說法不同時**以 `AGENTS.md` 為準**，並回報給維護者。
> 跨領域的規範在 [agent-rules.md](agent-rules.md)、後端在 [backend-agent-rules.md](backend-agent-rules.md)、
> 授權與答案隔離在 [security-agent-rules.md](security-agent-rules.md)、**API 契約與單一 HTTP 邊界在 [api-agent-rules.md](api-agent-rules.md)**，這裡不重複。

**`frontend/` 目前不存在**，所以下面每一條的「檢查方式」幾乎都還沒有自動檢查。標「待建置」就是字面意思：那些檢查要等實際有程式與 lint 設定才寫得出來，**不得因為這份文件存在就宣稱規則已被強制**。

## 開工前的前提都已定案

工作項 1 的前置條件是「維護者選定 React 版本、目錄分層、元件庫」。選定結果如下，本文件只是把它們寫下來：

| 前提 | 狀態 |
| :--- | :--- |
| 版本與框架 | **React 19** 加 Vite 加 TypeScript strict（**版本**由維護者 2026-11-10 裁定，覆寫 ADR-004 的 React 18）；路由 React Router v6、伺服器狀態 TanStack Query（**ADR-004 沿用**，不在那次裁定的範圍裡） |
| 目錄分層 | **`pages/` 加 `features/`**（維護者 2026-11-10 裁定，覆寫 ADR-011 的垂直功能切片） |
| 元件庫 | **shadcn/ui**，元件以原始碼形式放進 `components/ui/`（覆寫 ADR-016 的 `shared/ui/`）。**Storybook 仍待決**（[architecture.md](architecture.md) §待決清單 第 10 列） |
| API client 與型別 | **Orval**，產物在 `src/api/generated/`；規則在 [api-agent-rules.md](api-agent-rules.md) |
| design token 的映射 | **寫一層對照，`design/prototype/assets/tokens.css` 仍是唯一色值來源**（維護者 2026-11-10 裁定，見 F6） |
| 深色模式 | **要做**：側欄一鍵切換、立即生效、跨頁保持（規格 07-01 §外觀切換）；「跟隨系統」**跟著作業系統的設定變**（規格 01-04 §偏好設定 第 4 條、規格 07-01 §已確認決議 Q14，**維護者 2026-11-09 裁定**，Q14 取代 Q10） |

---

## 規範

每一條交付**適用路徑、禁止事項、正例、反例、例外條件、檢查方式、來源**。

### F1 分層與允許的 import

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/**` |
| **禁止** | 下層 import 上層；`features/` 之間互相 import；`components/ui/` 認識業務（讀 query hook、知道角色、import `features/`）；多層 `index.ts` barrel；一個無所不包的 `shared/` 桶；`pages/` 直接呼叫 `api/generated/` 以外的資料來源 |
| **正例** | 見下方的分層表與最小模組範例。跨 feature 要共用時，**往下搬到 `components/ui/` 或 `lib/`**，不是互相 import |
| **反例** | `features/annotation/` import `features/task-management/hooks/useTaskRole`（改成把它搬到 `lib/` 或由 `pages/` 傳進去）；`components/ui/data-table.tsx` 裡 `useListTasks()`；`src/shared/index.ts` 一次 re-export 四十個東西 |
| **例外** | `src/api/generated/`（Orval 產物）是**唯一**可以同時被 `pages/` 與 `features/` 直接 import 的「有業務語意」的目錄；它是契約的投影，不是業務邏輯。`app/` 可以 import 全部，因為 router 與 provider 必須組裝所有層 |
| **檢查方式** | **待建置**。可用 `eslint-plugin-boundaries` 或 `eslint-plugin-import` 的 `no-restricted-paths` 把下表寫成機械規則，並用 `import/no-cycle` 擋循環；兩者都要等 `frontend/` 與它的 lint 設定 |
| **來源** | 維護者 2026-11-10 裁定（`pages/` 加 `features/`、`components/ui/`）；scaffold `frontend.md` §元件分層 的四層表**沿用**（路徑換成本 repo 的 `frontend/src/`）。原始 repo `frontend.md` 的垂直功能切片與 `shared/` 准入規則（「被兩個以上 feature 直接 import 才能進 `shared/`」）**不採用**——ADR-011 已被覆寫；它的用意（共用要有門檻）改由「往下搬到 `components/ui/` 或 `lib/`」承接。原始 repo foundation spec FR-013 的「生成型別是 `shared/` 的唯一 domain-specific 例外」**沿用其精神**：本 repo 沒有 `shared/`，對應的例外是 `api/generated/`。**下表七層裡只有 `pages/`、`features/`、`components/ui/` 來自裁定**；`app/` 與 `lib/` 來自 scaffold 的四層表（它的 `src/app/` 與 `src/lib/utils.ts`），`api/` 來自 [#108](https://github.com/label-suite/label-suite/issues/108) 的 Orval 輸出路徑裁定，`styles/` 來自本輪的 token 映射裁定與 scaffold `design-tokens.md` 的 `web/src/styles/` |

| 層 | 位置 | 放什麼 | 可以 import |
| :--- | :--- | :--- | :--- |
| app | `src/app/` | router、provider、全站 layout | 全部 |
| pages | `src/pages/<page>/` | 路由頁：讀路由與 query string、組合 features | features、components、api、lib |
| features | `src/features/<feature>/` | 業務元件與 hooks（呼叫 Orval 產生的 hooks） | components、api、lib |
| components | `src/components/ui/` | shadcn 元件與純 UI 元件，**不知道業務** | lib |
| api | `src/api/` | Orval 的設定與產物（`generated/`）、mutator | lib |
| lib | `src/lib/` | 不含業務的工具（`cn()`、日期格式化入口、型別 guard） | 無（只靠第三方） |
| styles | `src/styles/` | Tailwind 入口與 token 對照層（F6） | 無 |

**最小模組範例**（工作項 1 要求的那一份）：

```text
src/
├─ pages/task-list/
│  ├─ task-list-page.tsx         讀 query string、組合下面兩個 feature 元件
│  └─ index.ts                   只 re-export 這一頁的入口，不是 barrel
├─ features/task-management/
│  ├─ components/task-table.tsx  讀 useListTasks()、處理四種畫面狀態
│  ├─ hooks/use-task-filters.ts  把篩選與分頁讀寫到 query string
│  └─ index.ts                   公開邊界：只匯出 page 用得到的東西
├─ components/ui/data-table.tsx  不知道「任務」是什麼，只收 columns 與 rows
└─ lib/date.ts                   日期格式化的單一入口（F10）
```

`features/<feature>/index.ts` 是那個 feature 的**公開邊界**：`pages/` 只從它匯入。feature 內部的檔案互相 import 不受限，但不得被外面直接 import。

### F2 型別安全

| | |
| :--- | :--- |
| **適用路徑** | `frontend/**/*.ts`、`frontend/**/*.tsx` |
| **禁止** | `any`（含隱含 `any`：沒標註的參數、`catch (e)` 當 `any` 用）；用 `as` 或 `!` 掩蓋可能的缺值；手寫 API 型別（見 [api-agent-rules.md](api-agent-rules.md) A6）；關掉 `strict` 底下任何一項 |
| **正例** | `tsconfig` 開 `strict`；外部資料先當 `unknown`，再用 runtime schema 或 type guard 收窄；`catch (error: unknown)` 後用 helper 轉成已知型別；要擴充 API 型別時從產物衍生（`Pick<TaskDto, 'id' \| 'name'>`） |
| **反例** | `const task = list.find(t => t.id === id)!`（找不到就是 `undefined`，`!` 只是把問題延後到執行期）；`JSON.parse(raw) as TaskDraft`（`raw` 來自 `localStorage`，沒有任何驗證）；`function onChange(e)`（隱含 `any`） |
| **例外** | （1）`as const`；（2）`src/api/generated/`：產物由工具產生，不受本條約束也不得手改；（3）第三方套件的型別缺口：允許一處 `as`，但要在**同一行**寫註解指出是哪個套件的哪個缺口；（4）框架要求 `export default` 的檔案（Vite／Vitest／Playwright／Orval 的設定檔），見 F11 |
| **檢查方式** | **待建置**。`tsc --noEmit` 加 `@typescript-eslint` 的 `no-explicit-any`、`no-non-null-assertion`、`no-unsafe-*` 系列可以把前三項變成機械檢查；「外部資料要先驗證」只能靠審查 |
| **來源** | `AGENTS.md` 硬性規則 7（TypeScript 不得有 `any`）；原始 repo `frontend.md` §TypeScript Code Style 的「strict、禁 `any`、props 用 `interface`」**沿用**；scaffold `typescript.md` 與 duty-mate `typescript.md` 的 `unknown` 加收窄**沿用**。兩者的「禁止 `as`」**沿用**，連它們自己的例外（scaffold 的「唯一例外是 `as const`」、duty-mate 的「escape hatch 除外」）一起收下，**另增補第三方型別缺口那一類**；scaffold 的「禁止 default export」同樣沿用它既有的工具設定檔例外，並**增補 `.notecraft/components/*.tsx`**。#109 工作項 2 要的是「例外明列」，不是推翻禁止 |

**「外部資料」指的是契約以外的來源。** API 回應經 Orval 產物已經有型別，而且契約有 CI 把關（見 [api-agent-rules.md](api-agent-rules.md) A5），所以不必再寫一層 runtime schema。要先當 `unknown` 的是：query string 與路由參數、`localStorage`／`sessionStorage`、使用者上傳的檔案內容、第三方 SDK 的回呼參數、`postMessage`。這幾種都是 `AGENTS.md` 硬性規則 9 所說的「使用者輸入」。

### F3 Hooks 的呼叫順序、依賴與清理

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/**/*.tsx`、`frontend/src/**/use-*.ts` |
| **禁止** | 在條件、迴圈或 early return 之後呼叫 hook；用註解關掉依賴檢查而不說明；訂閱、計時器、`AbortController` 沒有 cleanup；把 server 資料抄進 `useState`；用 `useEffect` 加 `fetch` 自己重建一層資料層 |
| **正例** | hook 一律在元件最上層無條件呼叫；衍生值**直接從 query data 算**（必要時 `useMemo`）；取伺服器資料一律用 Orval 產生的 query hook；訂閱與計時器在 `useEffect` 的 return 裡清掉 |
| **反例** | `if (!taskId) return null;` 之後才 `useQuery(...)`；`const [rows, setRows] = useState([]); useEffect(() => { fetch('/api/v1/tasks').then(r => setRows(r.items)); }, [])`（兩個錯：自己 fetch 繞過單一 HTTP 邊界，又把 server 狀態複製一份）；`useEffect(() => setFullName(first + ' ' + last), [first, last])`（直接算就好） |
| **例外** | `useEffect` 本身**不是禁止事項**。合法用途：訂閱外部事件（`window` 的 resize、`matchMedia`）、與瀏覽器 API 同步（`document.title`、焦點、捲動位置）、非 React 的第三方實例生命週期、以及把狀態寫回網址以外的宿主環境。這幾類都要有 cleanup |
| **檢查方式** | **待建置**。`eslint-plugin-react-hooks` 的 `rules-of-hooks` 與 `exhaustive-deps` 可以擋前兩項；「不要用 effect 重建資料層」要靠審查 |
| **來源** | React 的 Hooks 規則（框架層，不是本專案的決定）；scaffold `frontend.md` §狀態管理 的「不把 API 資料複製到 `useState`／context、衍生值直接從 query data 計算」**沿用**；原始 repo foundation spec FR-059（server state 的單一邊界）**沿用**。工作項 3 明文要求「合法訂閱／瀏覽器同步不全面禁 `useEffect`」，所以例外那一格是本條的必要部分 |

### F4 狀態的三個去處

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/**` |
| **禁止** | 把可分享的篩選或分頁只放在元件 state；為了「以後可能需要」先裝一個全域 store；把 token 或角色放進前端 store 當授權依據。（「不得把 API 回應複製進全域 store」在 [api-agent-rules.md](api-agent-rules.md) A9，這裡不重複，只標出它是三分法的第一格） |
| **正例** | 三分法：**伺服器狀態走 TanStack Query**（細節見 [api-agent-rules.md](api-agent-rules.md) A9）、**可分享的狀態走網址的 query string**（關鍵字、篩選、每頁筆數、頁次、目前分頁）、**純局部 UI 狀態走 `useState`**（下拉開合、游標位置、未送出的表單草稿） |
| **反例** | 篩選條件只存在 `useState`——重新整理就掉了，而規格要求「重新整理還原查詢條件」；把 `listTasks` 的結果再存一份進 Zustand；用全域 store 存「目前使用者的角色」並以它決定能不能取得資料（角色只供顯示，見 [security-agent-rules.md](security-agent-rules.md) S3） |
| **例外** | 需要全域 store 時**要在該 change 的 `design.md` 寫出理由**（跨路由共用、而且不是 server 狀態、也不適合放網址），經規劃審閱同意才引入。本條不預先禁止所有全域狀態。另有**第四個去處是規格定的**：外觀偏好（淺色／深色／跟隨系統）**只記在使用者這台瀏覽器**，換一台裝置要重新選一次（規格 01-04 §偏好設定），所以它既不是 server 狀態也不進網址 |
| **檢查方式** | **待建置**。可用 lint 擋住 `features/` 直接 import 任何 store 套件（在它被引入之前，那條規則等於「不得引入」）；網址同步的行為由規格的 Scenario 驗（E2E）。外觀偏好另有一條規格 Scenario 要驗：「重新整理後仍然是深色，**載入時不先閃一下淺色**」（規格 01-04） |
| **來源** | ADR-004（TanStack Query）；**網址那一格是本 repo 規格已定的**：規格 03-01 §查詢條件保留在網址（關鍵字、三個篩選器、每頁筆數與頁次都寫進網址，無效值忽略並正規化）與規格 03-03 §網址與畫面狀態同步（分頁與篩選寫進網址，分享網址重現同一個畫面）。scaffold `frontend.md` §狀態管理 的「篩選分頁放 URL search params、不引入全域 store 除非 design 有理由」**沿用**。原始 repo `frontend.md` 的「Zustand 存 auth token／user／role」**不採用**（已在 [#107](https://github.com/label-suite/label-suite/issues/107) 列為不採用：`httpOnly` cookie 的意義就是 JS 讀不到） |

### F5 重用與不過度抽象

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/**` |
| **禁止** | 新寫一個 component／hook／util 之前沒有先搜尋既有的；每一頁各自重造 Button、Dialog、Table、Skeleton；把還只有一處用到的程式先抽成共用元件；無差別地 `memo`／`useMemo`／`useCallback` 包一層 |
| **正例** | 先 grep 既有的名稱與相近語意，再決定新增；shadcn 已有的元件優先用 `components/ui/`，不夠用時先擴充它的 props；**兩處確實是同一個概念時**才抽（判準見 [agent-rules.md](agent-rules.md) R4），不以出現次數為門檻；`memo` 只在有量測到的重繪問題時加，並在註解寫出原因 |
| **反例** | `features/annotation/components/my-button.tsx` 自己寫一顆按鈕；把只有一處用到的 `formatTaskName` 放進 `lib/`；整個 feature 的每個元件都包 `React.memo` |
| **例外** | 無。設計上需要一次抽象（例如同一個 change 內同時建立三個同構頁面）時，在該 change 的 `design.md` 寫明 |
| **檢查方式** | **待建置**。這一條**不設行數門檻**，所以沒有機械檢查，由 `code-reviewer` 依職責判斷 |
| **來源** | [agent-rules.md](agent-rules.md) 的 R1（先搜尋再新增）與 **R4（不過度抽象）沿用**，本條只是前端的落點。R4 的判準是「兩個地方有同一段邏輯，而它**確實是同一個概念**」，而 `agent-rules.md` §來源對照 已把原始 repo `general.md` 的「同一段程式出現 2 次以上就抽出共用」標為**不採用**（「出現兩次不代表是同一個概念」）。scaffold `frontend.md` 的「**一個檔案一個主要元件；超過約 200 行就拆**」**不採用那個數字**——[#105](https://github.com/label-suite/label-suite/issues/105) 已經把三個機械門檻（200 行、第二次重複才抽、5 檔案／300 diff 行）當成「不以行數取代職責審查」的例子駁回，而工作項 5 又明文重申一次。「一個檔案一個主要元件」沿用 |

### F6 視覺基準與 design token 的映射

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/styles/**`、`frontend/src/components/ui/**`，以及任何寫樣式的地方 |
| **禁止** | 在元件寫死色碼（class、`style`、SVG 屬性都算）；用 Tailwind 原色 class（`bg-blue-500`、`text-gray-600`）；寫 `p-[13px]` 這類**字面數值**的任意值去對齊品牌刻度（**引用變數的任意值不在此限**，見下面第 3 點）；把 scaffold 的 `neutral.css`／`trendlink.css` 主題搬進來；在元件裡依主題做條件判斷；**改寫 `components/ui/` 的 shadcn 元件去讀別的變數名**（裁定明文「shadcn 元件一行都不改」，那是被否決的另一個選項） |
| **正例** | **對照層在 `src/styles/`**：shadcn 的語意變數指向 `tokens.css` 的值（`--background: var(--color-surface)`、`--foreground: var(--color-ink)`…），色值**只存在 `tokens.css` 一處**；元件只用語意 class（`bg-background`、`text-muted-foreground`）；深色模式由 `html[data-theme="dark"]` 驅動，shadcn 的 dark variant 設成吃那個屬性 |
| **反例** | `<div className="bg-[#6366F1]">`；`<path stroke="#e5e7eb" />`（改成 `currentColor` 或 `var(--color-border)`）；在 `src/styles/themes/neutral.css` 貼一份 shadcn 預設色值——那會變成第二個色值來源 |
| **例外** | `tokens.css` 自己是色值的所在地，不受「不得寫色碼」限制。`design/prototype/` 的 HTML 另有自己的用法，不受本條約束（而且**本文件這一類工作不得改 `design/prototype/`**） |
| **檢查方式** | **待建置**。可用 stylelint 或自寫腳本掃 `#[0-9a-f]{3,6}`、`rgb(`、Tailwind 原色 class 與任意值 class；對照層是否齊全要靠審查 |
| **來源** | **維護者 2026-11-10 裁定**：寫一層對照、`tokens.css` 仍是唯一色值來源。`tokens.css`（92 個不重複的變數名）與 `label-suite-design` skill 是視覺基準；scaffold `design-tokens.md` 的**結構沿用**（色值只寫在一處、元件只用語意 token、換主題不改元件、新增 token 要每個主題檔都補），但它的 `themes/neutral.css`／`trendlink.css` **不採用**（工作項 6 明文）。深色模式是本 repo 規格已定（規格 07-01 §外觀切換、規格 01-04 §偏好設定、規格 03-02 的深色 Scenario）；**「跟隨系統」跟著作業系統**是維護者 2026-11-09 的裁定（規格 01-04 Q7、規格 07-01 Q14 取代 Q10）。⚠️ `glossary.mdx` 的 `term.appearance-mode` 仍寫著被取代的「固定呈現淺色」，本張一併改正 |

**映射前要逐一確認三件事，不是改個名字就好。**（**本文件的要求，非裁定內容**——維護者的裁定只有「寫一層對照」與「`tokens.css` 唯一色值來源」兩件；下面三件是落地時的已知坑，都已經有人踩過。）

1. **shadcn 沒有對應語意的 token 要另外決定落點。** `tokens.css` 有 `--color-cta`（確認、完成類的主要按鈕）、`--color-ink-muted`、`--workspace-tab-min-width` 這些 shadcn 沒有的語意。對照層只能處理「兩邊都有」的部分；剩下的要嘛新增 shadcn 風格的語意變數（並在對照層與元件都用它），要嘛直接用 `tokens.css` 的變數名。**哪些走哪一條，在第一個前端 change 的 `ui-design.md` 逐一列出**，不逐案自由心證。
2. **`--radius-*` 與 `--font-sans` 和 Tailwind v4 的 theme namespace 同名。** scaffold 自己的 `design-tokens.md` 就記著「主題檔的 `@theme` 不得重複定義 `globals.css` 的 `@theme inline` 已有的**變數**（`--font-sans`、`--radius-*`、`--color-*`）」。而 `tokens.css` 有 `--radius-sm/md/lg`（4／8／12px）與 `--font-sans`。把它們接進 Tailwind 的 `@theme` 會**改掉 `rounded-*` 這些既有 utility 的語意**，所以映射時要逐一確認會動到哪些 utility，並在 PR 寫出來。
3. **映射數字 spacing key 會讓尺寸靜默放大。** duty-mate 的 `tailwind-theme.md` 記了一次事故：`@theme` 定義了具名的 `--spacing-10` 之後，`w-10` 從 40px 變成 80px，開關元件的圓鈕位移比例全錯。本 repo 的間距 token 是 t-shirt 命名（`--space-xs/sm/md/lg/xl/2xl/3xl`），不會逐字重演那個案例，但**同類的 namespace 覆蓋要一樣小心**；需要 token 間距時用任意值引用變數（`p-[var(--space-lg)]`），不要去覆蓋 Tailwind 的數字刻度。

### F7 圖示與 SVG

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/**` |
| **禁止** | 加入 Lucide 以外的圖示庫（Heroicons、react-icons、Font Awesome…）；用 emoji 當圖示；為了一個圖示自己手畫 inline SVG；圖示寫死顏色或用 HTML 的 `width`／`height` 屬性 |
| **正例** | 一律 `lucide-react`；尺寸與顏色由呼叫端用語意 class 傳入（`className="w-4 h-4 text-muted-foreground"`）；Lucide 缺某個圖示時**回報**，不自己畫 |
| **反例** | `import { FiUser } from 'react-icons/fi'`；`<span>✅</span>` 當狀態圖示；`<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>` 自己畫一個勾 |
| **例外** | 四類，各自有來源：（1）**品牌與 logo 標記**（彩色 logo、banner、Google SSO 的 G）——[architecture.md](architecture.md) §前端 明文；（2）**資料視覺化的 SVG**——長條圖、趨勢圖、分佈圖是畫資料不是畫圖示（規格 05-02 統計總覽分頁的各型統計區塊（§單一標籤的統計、§多標籤的統計、§實體辨識的統計、§多維度的統計）的橫向長條、軸標籤與圖例），顏色仍只能用 token；（3）**`design/prototype/` 的 inline SVG**——設計層沒有 npm，architecture.md 已明文允許，條件是每個字形都複製自真實的 Lucide 圖示；（4）**文件生成的 `.notecraft/components/*.tsx`**——NoteCraft 的視覺化元件自己畫圖，不是產品碼 |
| **檢查方式** | **待建置**。可用 lint 擋住 `lucide-react` 以外的圖示套件 import，並掃產品碼裡的 `<svg`（例外要逐一標註）；prototype 的 Lucide 一致性目前只有人工 |
| **來源** | ADR-030（Lucide 是唯一圖示來源）與 [architecture.md](architecture.md) §前端 的例外**沿用**；duty-mate `icon-usage.md` 的**理由與事故沿用**（集中管理才能保證 `stroke-width`、`viewBox` 與端點風格一致；它散寫 inline SVG 的結果是 `stroke-width` 混用 1.5／1.9／2／2.5、尺寸單位混用三種），它的 Handlebars partial 做法不適用。**工作項 7 明文要求不得把「禁手繪 icon」擴張成「禁所有 SVG」**，所以例外（2）（3）（4）是本條的必要部分 |

### F8 四種畫面狀態與表單

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/pages/**`、`frontend/src/features/**` |
| **禁止** | 取資料的區塊少處理任何一種狀態；把 `403` 當成一般錯誤顯示重試；用「沒有資料」當成載入失敗的呈現；表單在送出期間還能再按一次；前端自己猜某個角色看不到什麼而把欄位藏起來 |
| **正例** | 每個資料區塊四種狀態齊備：**loading** 用 skeleton、維持版面不跳動；**error**（非 `403`）顯示訊息與重試；**empty** 顯示說明，有權限時附新增入口；**無權限**（`403`）顯示無權限說明、**不給重試**。表單要處理驗證訊息、送出期間 disabled、以及可預期錯誤（`409`、`400`）顯示在對應欄位 |
| **反例** | `if (isLoading) return null`（版面跳動）；`403` 顯示「載入失敗，請重試」（重試永遠不會成功）；後端已經把欄位遮成固定值，前端又依角色再判斷一次要不要顯示 |
| **例外** | 不取資料的靜態區塊沒有這四種狀態。樂觀更新允許，但要在該 change 的 `design.md` 寫出回滾方式。**逐頁的規格可以比這四種更嚴**：規格 05-01 §四種互斥的頁面狀態 與規格 05-02 §兩個分頁各有一組自己的狀態（統計四種、品質六種，明文「不得互相代用」）就是更嚴的版本，那兩頁以規格為準 |
| **檢查方式** | **待建置**。四種狀態與遮蔽欄位的呈現由該 change 的 `ui-design.md` 逐區塊寫出，`design-reviewer` 與 `code-reviewer` 的 checklist 已各有一條；E2E 由規格的 Scenario 驗——但要注意**規格 03-01 §空狀態與載入失敗 只涵蓋三種**（完全沒有任務、篩選後沒有符合、載入失敗），**沒有 `403`**；無權限那一種的 Scenario 在各頁的權限條文裡（例如規格 03-01 的「沒有權限時停在列表」） |
| **來源** | [architecture.md](architecture.md) §前端 的「每個資料區塊都要寫出 loading、error、empty、無權限四種狀態，以及被遮蔽欄位的呈現方式」**沿用**（它明寫 ADR 沒有定義這個最低要求，由 OpenSpec 的 `ui-design` 產出負責）；scaffold `frontend.md` §四種畫面狀態 的判斷與呈現**沿用**（含「`403` 不顯示重試」）。「遮蔽依契約呈現、不自行猜角色」來自 [security-agent-rules.md](security-agent-rules.md) S4 與 [api-agent-rules.md](api-agent-rules.md) A2；「送出期間 disabled」在 A9 |

### F9 無障礙的最低要求

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/**/*.tsx` |
| **禁止** | 用 `div onClick` 代替 `button`；表單欄位沒有關聯的標籤；只有圖示的按鈕沒有可存取名稱；把 shadcn Dialog 的焦點處理拆掉；只用顏色表達狀態；忽略使用者「減少動態效果」的偏好 |
| **正例** | 互動元素用語意元素（`button`、`a`、`label`）；每個欄位有 `<Label htmlFor>`；錯誤訊息用 `aria-describedby` 關聯到欄位；只有圖示的按鈕加 `aria-label`，裝飾性圖示加 `aria-hidden`；Tab 順序合理、Dialog 開關時焦點正確；狀態同時用文字或圖示表達，不只靠顏色；**`prefers-reduced-motion` 時過場動畫降到最低，操作本身照常可用** |
| **反例** | `<div className="cursor-pointer" onClick={...}>送出</div>`；只用紅色的框表示驗證失敗而沒有訊息；側欄收合動畫在使用者關閉動態效果後照播 |
| **例外** | 無。裝飾性元素不需要可存取名稱，但要明確標成裝飾（`aria-hidden`） |
| **檢查方式** | **待建置**。`eslint-plugin-jsx-a11y` 可以擋語意元素與 `aria-label` 的缺漏；對比度與鍵盤流程要靠 Playwright 的 a11y 檢查與人工。**`tokens.css` 已經把對比度當成議題處理過**（多個 token 的註解寫著 WCAG AA 的修正與接受的取捨），所以色票本身不需要再驗一次，要驗的是元件有沒有用對 token |
| **來源** | scaffold `frontend.md` §無障礙 的**五條**（語意元素、標籤與錯誤關聯、icon button 名稱、鍵盤與 Dialog 焦點、狀態不只靠顏色）**沿用**；**「減少動態效果」是本 repo 規格已定**：規格 03-02 §深色模式與動畫 第 2 條與它的 Scenario「要求減少動畫時動畫降到最低」，規格 07-01 的邊界情況「使用者在作業系統關閉了動態效果 → 側欄收合、次選單展開與通知清單展開都不播動畫，操作本身照常可用」與對應 Scenario |

### F10 日期、時區與可測的時鐘

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/**`（日期的讀寫、比較與格式化） |
| **禁止** | 在元件各自 `new Date()`／`Date.now()` 做邏輯；把只有日期的欄位當成時間點處理；把顯示用的時區寫死成某個固定時區；在元件裡自己拼日期格式字串；測試依賴真實時間 |
| **正例** | 四種概念分開：**時間點**在傳輸與儲存一律 UTC 的 ISO 8601 字串（`2026-11-10T02:30:00.000Z`）；**只有日期**的欄位用 `YYYY-MM-DD` 字串傳輸，不轉成時間點；**顯示**依瀏覽者裝置的時區；**報表的日期區間**固定以台北時區計算。所有格式化與比較走 `src/lib/date.ts` 單一入口，入口裡可以注入時鐘讓測試固定「現在」 |
| **反例** | `new Date(task.createdAt).toLocaleString()` 散在十個元件裡（格式與時區各自分歧）；把 `YYYY-MM-DD` 的生效日當成午夜時間點再轉時區（日期會跳一天）；把顯示時區寫成 `Asia/Taipei`——**本 repo 的裁定是裝置時區** |
| **例外** | 第三方套件要求原生 `Date` 時，在呼叫處轉換；測試用的假時鐘（`vi.setSystemTime`）屬框架機制。**本條不全面禁止原生 `Date`**：要求的是「邏輯走單一入口」，不是「某個 API 一律不准出現」 |
| **檢查方式** | **待建置**。可用 lint 擋住 `src/lib/date.ts` 以外的地方 import 日期套件；「只有日期的欄位不轉時間點」要靠審查與規格的 Scenario |
| **來源** | **顯示時區是本 repo 規格已定案**：規格 06-01 Q2「依瀏覽者裝置的時區」（已定案 2026-11-04，依據由維護者 2026-11-09 裁定），它的 Scenario 寫明東京時區的裝置看到的是當地時間；規格 03-01 §任務列的欄位 把時區比照規格 06-01 §資料欄位。**報表固定台北時區**來自規格 03-03 §工時紀錄 第 10 條「報表的日期固定以台北時區計算，跨日的部分在查詢時以當地午夜切開」。UTC 儲存與 ISO 傳輸、date-only 用字串**沿用** scaffold `date-handling.md`，但它的「顯示時轉 `Asia/Taipei`」**不採用**（與本 repo 的裝置時區裁定相反）。duty-mate `date-handling.md` 的**單一入口理由沿用**（集中管理 timezone、locale 與 plugin，避免各檔案重複 setup 導致行為分歧），它的「全面禁止原生 `Date` API」**不採用**——工作項 10 明文「不盲抄 duty-mate 全面禁 Date/day.js 的框架細節」 |

**日期套件還沒選。** 兩份來源都用 day.js，但本 repo 沒有任何 ADR 或裁定選過它。所以本條只要求**單一入口**與上面四種概念的分界；套件由第一個需要它的前端 change 在 `design.md` 提出，不在這份文件裡預先定案。

### F11 註解與 JSDoc

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/**` |
| **禁止** | 用註解複述名稱（「取得任務列表」）；寫中文註解在產品碼裡；在 JSDoc 重寫 TypeScript 已有的型別；寫其他專案的需求編號（`FR-001`、`T013`）；元件 props 寫成參數上的 inline 型別；改了行為不改註解 |
| **正例** | **英文**（`AGENTS.md` §Language Rules：程式與註解只用英文）；描述寫名稱看不出來的事——契約、前提、副作用、特殊值（`null` 與空陣列各代表什麼）；元件 props 宣告成具名 `interface XxxProps`，每個欄位一行說明；公開的 hook 與工具函式標明回傳型別與會拋出的錯誤 |
| **反例** | `/** 任務表格 */ export function TaskTable(...)`（沒說出任何名稱以外的資訊）；`/** @param {string} id 任務 ID */`（型別重複、而且是中文）；`export function TaskTable({ items }: { items: TaskDto[] })`（inline props，欄位無法逐一說明） |
| **例外** | （1）匿名 callback 不寫；（2）測試檔不強制；（3）`src/api/generated/`：產物不寫、也不手改；（4）**`.notecraft/components/*.tsx` 的 `export default` 是 NoteCraft 的契約**——本 repo 現有 22 個這樣的檔案，產品碼的 named-export 慣例**不得**套用到它們；（5）框架要求 `export default` 的設定檔（Vite／Vitest／Playwright／Orval） |
| **檢查方式** | **待建置**。`eslint-plugin-jsdoc` 可以檢查「有沒有、格式對不對」，描述與行為是否一致由 `code-reviewer` 審。**本條不要求每個具名單位都有 JSDoc**，所以覆蓋率沒有門檻 |
| **來源** | `AGENTS.md` §Language Rules（程式與註解只用英文）；scaffold `jsdoc.md` 的**內容要求沿用**（描述要寫名稱看不出來的資訊、不寫型別、`@throws` 寫觸發條件、props 用具名 `interface`、**不寫其他專案的需求編號**、產物與測試檔不寫），但它**開頭引言**的「每個具名的程式單位都要有 JSDoc」與 §內容要求 第 1 條的「描述句用繁體中文」**都不採用**；它的 §適用範圍 表（哪些要寫、哪些不寫）本文件沿用成 F11 的例外——工作項 11 明文。原始 repo `frontend.md` §TypeScript Code Style 的「props 用 `interface`」**沿用** |

---

## 刻意不採用的來源條文

| 不採用 | 出處 | 為什麼 |
| :--- | :--- | :--- |
| 垂直功能切片與 `shared/` 准入規則 | 原始 repo `frontend.md` §Architecture Principles（ADR-011） | ADR-011 已被 2026-11-10 的裁定覆寫成 `pages/` 加 `features/`。用意由 F1 的「往下搬到 `components/ui/` 或 `lib/`」承接 |
| 「Zustand 存 auth token／user／role」 | 原始 repo `frontend.md` §State management | 與 httpOnly cookie 根本不相容（[#107](https://github.com/label-suite/label-suite/issues/107) 已列為不採用） |
| 「System role 從 JWT 取」當授權依據 | 原始 repo `frontend.md` §Role model | ADR-037：`role` 只供顯示。決定版面可以，當成能否取得資料的依據不行（#107 的 S3） |
| 「禁止型別斷言 `as`」只留 `as const` 一個例外 | scaffold `typescript.md`（「唯一例外是 `as const`」）、duty-mate `typescript.md`（標題寫「escape hatch 除外」） | **沿用其禁止與 `as const` 例外，另增補一類**：第三方套件的型別缺口允許一處，但要在同一行註明是哪個套件的哪個缺口（F2 例外 3）。工作項 2 要求例外要列出來 |
| 「Named export，禁止 default export」的例外清單 | scaffold `typescript.md`（例外已含 Vite／Vitest／Playwright／Orval 設定檔與 `*.config.ts`） | **沿用，另增補一類**：本 repo 有 22 個 `.notecraft/components/*.tsx` 依 NoteCraft 契約必須 default export（F11 例外 4）。來源沒有這一類，因為它沒有 NoteCraft |
| 「超過約 200 行就拆檔」 | scaffold `frontend.md` §元件分層 | [#105](https://github.com/label-suite/label-suite/issues/105) 已駁回三個機械門檻，工作項 5 又重申一次「不以固定行數取代職責審查」 |
| `themes/neutral.css`（shadcn 預設）與 `themes/trendlink.css` | scaffold `design-tokens.md` | 工作項 6 明文不得混入。本 repo 的唯一色值來源是 `tokens.css` |
| 顯示時轉 `Asia/Taipei` | scaffold `date-handling.md` | 與規格 06-01 Q2 的已定案裁定相反——本 repo 顯示依**瀏覽者裝置**的時區。只有「報表的日期區間」才固定台北（規格 03-03） |
| 「禁止原生 `Date` API」這條鐵律本身 | duty-mate `date-handling.md`、scaffold `date-handling.md`（兩份都另有 `## 例外`，含第三方 adapter 與測試假時鐘） | **不採用那條鐵律**（工作項 10 明文不盲抄框架細節），改成要求**單一入口**與四種概念的分界；**它們的例外清單沿用**第三方 adapter 與假時鐘兩條（F10 例外） |
| 「每個具名的程式單位都要有 JSDoc」與繁體中文描述 | scaffold `jsdoc.md` 的開頭引言與 §內容要求 第 1 條 | 工作項 11 明文。而且中文註解違反 `AGENTS.md` §Language Rules |
| Handlebars 的 `{{> icon}}` partial 做法 | duty-mate `icon-usage.md` | 棧不同（SSR 模板 vs React）。它的理由與事故沿用在 F7 |

---

## 來源對照

### 原始 repo（`singyichen/label-suite@faf83356`）

**這張表的範圍是前端的依賴方向、型別安全與 UI 共用。** `frontend.md` §Architecture Principles 的 **Localization** 那一段的 i18n 分工歸 [api-agent-rules.md](api-agent-rules.md) A8，§Architecture Principles 的 **State management** 那一段的 TanStack Query 細節歸 A9，所以某一節沒出現在下表，是被排除、不是被漏掉。

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| §Architecture Principles 的垂直功能切片與 `shared/` 准入 | **不採用** | 見上表 |
| §Architecture Principles 的 **State management** 那一段的「TanStack Query 管所有 API／server state」 | **沿用** | 成為 F4 的第一格；細節在 A9 |
| §Architecture Principles 的 **State management** 那一段的「Zustand 存 token／user／role」 | **不採用** | 見上表 |
| §Architecture Principles 的 **State management** 那一段的「`useState` 管局部元件狀態」 | **沿用** | 成為 F4 的第三格 |
| §Architecture Principles 的 **Role model** 那一段的兩層角色（系統角色與任務角色） | **沿用但不在本文件** | 授權的規則在 [security-agent-rules.md](security-agent-rules.md) S3；前端只負責「角色決定顯示哪一種版面」 |
| §Architecture Principles 的 **Localization** 那一段的命名空間與「不要放後端 `detail` 副本」 | **不在本文件** | 歸 [api-agent-rules.md](api-agent-rules.md) A8 |
| §Icons（Lucide 是唯一圖示庫、不用 emoji 與手畫 inline SVG、**prototype 的素材要遵循同一套 Lucide 視覺語彙**：24×24、2px stroke、`currentColor`） | **沿用** | 成為 F7。注意它那一條是**把規則延伸到 prototype**，不是豁免 prototype；真正的豁免（設計層沒有 npm，所以允許內嵌 SVG）在本 repo 的 [architecture.md](architecture.md) §前端 |
| §TypeScript Code Style 的「strict、禁 `any`、props 用 `interface`、`type` 給 union」 | **沿用** | 成為 F2 與 F11 |
| §TypeScript Code Style 的「優先函式元件加 hooks」 | **沿用** | 成為 F3 的前提（本 repo 不寫 class 元件） |
| foundation spec FR-013（`shared/` 只放跨兩個以上 feature 且 domain-neutral 的程式，生成型別是唯一例外） | **沿用其精神** | 本 repo 沒有 `shared/`；對應的例外是 `api/generated/`，見 F1 的例外格 |
| foundation spec FR-059（server state 的單一邊界、不得用全域 store 複製） | **沿用** | 成為 F3 與 F4 |

### scaffold（`fullstack-ai-sdd-workflow-scaffold`，本機與 `trendlink`）

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `frontend.md` §元件分層 的四層表與「下層不 import 上層、features 不互相 import、共用往下搬」 | **沿用** | 成為 F1，路徑換成本 repo 的 `frontend/src/` |
| `frontend.md` §元件分層 的「一個檔案一個主要元件」 | **沿用** | 成為 F5 |
| `frontend.md` §元件分層 的「超過約 200 行就拆」 | **不採用** | 見上表 |
| `frontend.md` §狀態管理 的**五條** | **沿用四條** | 成為 F3（不複製 server 資料、衍生值直接算）與 F4（URL search params、全域 store 要有理由）；mutation 的失效慣例在 A9 |
| `frontend.md` §元件 的「shadcn 優先、沒有的先 `npx shadcn add`、只用語意 token、icon 一律 `lucide-react`」 | **沿用** | 分別成為 F5、F6、F7 |
| `frontend.md` §四種畫面狀態（鐵律）的判斷與呈現表 | **沿用** | 成為 F8 |
| `frontend.md` §無障礙 的**五條**（語意元素、`Label htmlFor` 與 `aria-describedby`、icon button 的 `aria-label`、鍵盤與 Dialog 焦點、狀態不只靠顏色） | **沿用** | 成為 F9。**reduced motion 不在它裡面**——全 scaffold grep `reduced`／`動態效果` 零命中，那一項的依據是本 repo 的規格 |
| `frontend.md` §測試 的 Vitest 加 RTL 加 MSW、用 role 與可見文字查元素 | **不在本文件** | 測試歸 [#110](https://github.com/label-suite/label-suite/issues/110) |
| `typescript.md` §型別安全 的 `unknown` 加收窄、禁 `any` | **沿用** | 成為 F2 |
| `typescript.md` 的全面禁 `as`、全面禁 default export | **不採用** | 見上表 |
| `typescript.md` §型別定義 的「禁原生 `enum`，用 `as const` 加 union」、Utility Types、「API 型別一律來自產物」 | **沿用** | 前兩項成為 F2 的正例；第三項在 [api-agent-rules.md](api-agent-rules.md) A6 |
| `typescript.md` §命名 的表（檔名 kebab-case、元件 PascalCase、常數 UPPER_SNAKE、布林 `is/has/should`、hook `use` 開頭、`interface` 不加 `I`） | **沿用** | 本文件不重抄整張表，F1 的範例與 F11 的正例照它寫 |
| `typescript.md` §匯出 的「直接從模組檔匯入，避免多層 barrel 造成循環依賴」 | **沿用** | 成為 F1 的禁止事項 |
| `typescript.md` §錯誤處理 的 `catch (error: unknown)`、禁空 catch | **沿用** | 成為 F2 |
| `typescript.md` §檔案內順序 | **不採用** | 屬風格，本 repo 未立條文；由 lint 的 import 排序處理即可 |
| `design-tokens.md` 的三條鐵律與結構 | **沿用結構** | 成為 F6：色值只寫在一處、元件只用語意 token、換主題不改元件、新增 token 要每個主題都補 |
| `design-tokens.md` 的 `themes/*.css` 兩個主題檔 | **不採用** | 見上表 |
| `design-tokens.md` 的「主題檔的 `@theme` 不得重複定義 `globals.css` 的 `@theme inline` 已有的變數」 | **沿用** | 成為 F6 映射三坑的第 2 點——它正好點出本 repo 的 `--radius-*` 與 `--font-sans` 會撞到 Tailwind 的 namespace |
| `date-handling.md` 的 UTC 儲存、ISO 8601 傳輸、date-only 用字串、單一入口 | **沿用** | 成為 F10 |
| `date-handling.md` 的「顯示時轉 `Asia/Taipei`」與「全面禁原生 `Date`」 | **不採用** | 見上表 |
| `jsdoc.md` §內容要求 的八條 | **沿用原則** | 成為 F11（含「不寫其他專案的需求編號」） |
| `jsdoc.md` §適用範圍 的「每個具名單位都要有」與繁中描述 | **不採用** | 見上表 |
| `api-client.md`、`api-contract.md` | **不在本文件** | 歸 [api-agent-rules.md](api-agent-rules.md)（[#108](https://github.com/label-suite/label-suite/issues/108) 已完成） |

### duty-mate（`trendlink/duty-mate@c53cc453`，`develop`）

**它是 SSR（NestJS 加 Handlebars），沒有 React。** 所以同主題的四份規則裡，能沿用的是**理由與事故**，不是條文本身。

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `typescript.md` §型別安全（禁 `any`、禁非空斷言、禁 `as`） | **部分沿用** | 前兩項與 F2 同向；全面禁 `as` 不採用（見上表） |
| `date-handling.md` §統一入口（鐵律）與它的理由 | **沿用理由** | 「集中管理 timezone、locale、plugin 掛載，避免各檔案重複 setup 導致行為分歧」正是 F10 要求單一入口的原因 |
| `date-handling.md` §禁止原生 `Date` API（鐵律） | **不採用** | 見上表 |
| `icon-usage.md` §Icon 來源（鐵律）與它的事故 | **沿用理由與事故** | 散寫 inline SVG 的結果是 `stroke-width` 混用 1.5／1.9／2／2.5、尺寸單位混用 Tailwind class／任意值／HTML 屬性。成為 F7 的理由 |
| `icon-usage.md` 的「尺寸與顏色一律由呼叫端用 Tailwind class 傳入」 | **沿用** | 成為 F7 的正例 |
| `icon-usage.md` 的 `{{> icon}}` partial | **不採用** | 棧不同 |
| **`tailwind-theme.md` §禁止映射數字 spacing key（鐵律）與它的事故** | **沿用事故** | `@theme` 定義具名 `--spacing-10` 後 `w-10` 從 40px 變 80px，開關圓鈕位移比例全錯。本 repo 的間距 token 是 t-shirt 命名，不會逐字重演，但 namespace 覆蓋的風險一樣，見 F6 第 3 點 |
| `tailwind-theme.md` §需要 token 間距時的寫法（任意值引用變數） | **沿用** | 成為 F6 第 3 點的做法 |
| `tailwind-theme.md` §Layout 同步（兩份 `@theme inline` 要同步）與 hbs 快取 | **不採用** | Handlebars 的框架細節 |
| `dto-boolean.md`、`database.md`、`command.md`、`hbs-*.md`、`jest-mock-queue.md`、`integration-test-http.md` | **不在本文件** | 見 [api-agent-rules.md](api-agent-rules.md)、[backend-agent-rules.md](backend-agent-rules.md) 與 [#110](https://github.com/label-suite/label-suite/issues/110) 的對照 |

### starter-kit

**仍然對不上。** #109 點名它的 `frontend/react-typescript.md`——**這是第四張 issue 給出第四個不同的檔名**（#105 的 `core-principles.md`／`workflow.md`、#106 的 `backend/architecture.md`／`backend/database.md`、#108 的 `backend/api-design.md`／`frontend/api-client.md`）。依 [agent-rules.md](agent-rules.md) 記的教訓（「附帶搜尋清單的否定結論會勸退後面的人再查」），本張又實查一次：

- `trendlink` 組織底下每個 repo 的 git tree，grep `react-typescript`：**零命中**
- `singyichen` 底下每個 repo 的 git tree，grep 同字串：**零命中**
- 本機 `find ~/project -name react-typescript.md`：**零命中**

查核日期 2026-11-10。所以這一類沒有對照可做，也不編造。

---

## 變更紀錄

| Issue | 日期 | 變更 |
| :--- | :--- | :--- |
| [#109](https://github.com/label-suite/label-suite/issues/109) | 2026-11-10 | 獨立審查後修三個 High 與一批來源誤述：**前提表把被推翻的那一邊寫成前提**——「跟隨系統固定呈現淺色」出自 `glossary.mdx` 的過期敘述，而規格 01-04 Q7 與 07-01 Q14（**維護者 2026-11-09 裁定**，Q14 取代 Q10）都是「跟著作業系統」，等於在兩份說法相反時自行選了被推翻的一邊（`glossary.mdx` 一併改正）；**三條「不採用」建立在誤述上**——scaffold 與 duty-mate 的禁 `as`、禁 default export、禁原生 `Date` **本來就各有例外**，改寫成「沿用其例外並增補本 repo 的落點」；**F5 正例把 #105 駁回的門檻寫回來**（「第二個使用點出現時才抽」），改成 R4 的「確實是同一個概念」判準，F5 標題也從「不過早抽象」正名為「不過度抽象」。另修章節名與計數：scaffold §無障礙 是**五條**不是六條（**reduced motion 根本不在 scaffold 裡**，依據是本 repo 規格）、§狀態管理 是五條、`tokens.css` 是 **92 個**不重複變數名不是 140 個、原始 repo `frontend.md` 只有三個章節（State management 等是 §Architecture Principles 裡的粗體標籤）、§Icons 的 prototype 那一條是**延伸**不是豁免、規格 05-02 沒有 §統計總覽 這個章節、03-03 的條文在 §工時紀錄；並補上 F4 的第四個狀態去處（外觀偏好只記在這台瀏覽器）、F6 禁止列的「不得改寫 shadcn 元件」、F8 的逐頁更嚴規格、F1 七層表裡哪三層不是裁定 |
| [#109](https://github.com/label-suite/label-suite/issues/109) | 2026-11-10 | 初版。十一條規範（各帶適用路徑、禁止、正反例、例外條件、檢查方式與來源）、十一條刻意不採用的來源條文、原始 repo（含 foundation spec）／scaffold 五份／duty-mate 四份的逐條對照，以及 starter-kit 的實查紀錄 |
