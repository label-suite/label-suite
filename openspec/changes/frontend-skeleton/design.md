# Design

## Context

動機見 `proposal.md` §Why。本文只記實作前要定的技術決策；分層、類別、元件清單、處理順序與測試清單已寫在 `system-design.md`，畫面、文案與 token 落點已寫在 `ui-design.md`，回傳形狀、錯誤正規化、fixture 與 Orval 識別字已寫在 `api-contract.md`，這裡只指過去，不重抄。所有決策都依 `clarification.md` §決議 Q1–Q19，不重開。

現況與限制：

- `frontend/` 不存在；根目錄有 `package.json`（`packageManager: pnpm@10.18.3`、Prettier 3.10.1、lint-staged）但沒有 `pnpm-workspace.yaml`。CI 的 `format` job 以 Node 22 跑 `pnpm install --frozen-lockfile` 與 `pnpm format:check`。
- 後端（#504）已提交 `backend/openapi.json`，只有一個操作 `getHealth`；後端的 CORS 已允許 `Accept-Language`、`Content-Type`、`X-Correlation-ID`，公開 `X-Correlation-ID`，`allow_credentials=True`，本次不改後端。
- 視覺基準是 `design/prototype/assets/tokens.css`（`:root` 與 `html[data-theme="dark"]` 兩個區塊，檔頭另有 Google Fonts 的 `@import`，檔尾有元素規則）。本次不改 `design/prototype/`，也不改 `docs/specs/`。
- 畫面以 artifact 第 4 版為準（https://claude.ai/artifact/BA87odDCTUkTT6FWoRteUV，`Main.dc.html`、`Gallery.dc.html`，維護者 2026-11-20 核可）；會讓畫面偏離 artifact 的實作細節一律回到維護者。

## Goals / Non-Goals

**Goals:**

- 建出 `frontend/` 骨架，讓後續業務功能只需新增 `features/` 與 `pages/`，不必再定分層、HTTP 邊界、語系、token 或測試替身的做法。
- 讓 lint、型別檢查、測試、建置與契約漂移檢查五條指令都可以由根目錄以 `pnpm --filter frontend <script>` 執行，並寫進 `openspec/config.yaml` 的 `operations.apply.guidance`。
- 以健康檢查頁證明「產物 → `apiFetch` → TanStack Query → 畫面」整條路徑；以元件展示頁與完整性測試證明「原語宣告 → 展示」不會漂移。

**Non-Goals:**

- 認證、登入頁、`clear()` 快取、`403` 的畫面、業務頁共用的錯誤元件（屬 01-01；Q4、Q11）。
- 正式路由、首頁與找不到頁面（Q14）；瀏覽器端的 MSW 替身（Q6）；語言切換控制項（Q5）。
- Docker、`.env.example`、根目錄串起「後端匯出 → Orval」的指令、E2E 與 CI 的前端 job（屬 #506，見 §跨 change 依賴）。
- 覆蓋率門檻（Q12）；修改 `architecture.mdx`「shadcn 元件不改寫」那句（Q9，另開 `[Docs]` issue，不在本 change 的 tasks 內）。

## Decisions

### D1. 根目錄 pnpm workspace，前端是 `frontend` 套件

新增 `pnpm-workspace.yaml`（`packages: [frontend]`），`frontend/package.json` 名稱 `frontend`、版本 `0.0.0`、`private: true`，依賴一律以 `pnpm --filter frontend add`（`-D`）加入，共用根目錄一份 `pnpm-lock.yaml` 與根目錄的 Prettier。`frontend/package.json` 的 script：`dev`、`build`、`preview`、`lint`、`typecheck`（`tsc -b`）、`test`（`vitest run`）、`test:coverage`、`api:generate`（只跑 Orval）。

- 替代方案：`frontend/` 獨立 pnpm 專案（第二份 lockfile、第二個 Prettier 版本、`setup.sh` 多一步）。不採，理由見 Q7。
- 版本號 `0.0.0` 是新套件的初始值，不是版本升級（Hard Rule 4 管的是既有版本號）。
- 對應：system-design.md §關鍵設計細節「專案結構與要補進 `openspec/config.yaml` 的指令」；clarification Q7。

### D2. 套件組合

執行期：`react`、`react-dom`（19）、`react-router-dom`（v6）、`@tanstack/react-query`、`i18next`、`react-i18next`、`dayjs`、`lucide-react`、`class-variance-authority`、`clsx`、`tailwind-merge`，以及 shadcn 原語需要的 Radix 套件（以 shadcn CLI 實際加入的為準）。開發期：`vite`、`@vitejs/plugin-react`、`typescript`、`tailwindcss` 與 `@tailwindcss/vite`（v4）、`orval`、`msw`、`@faker-js/faker`、`vitest`、`@vitest/coverage-v8`、`jsdom`、`@testing-library/react`、`@testing-library/user-event`、`@testing-library/jest-dom`、`eslint` 與 `typescript-eslint`、`eslint-plugin-boundaries`、`eslint-plugin-react-hooks`、`eslint-plugin-react-refresh`、`@types/node`。

- 版本取 `pnpm add` 當下的最新穩定版並由 lockfile 鎖定；Node 版本與 CI 一致（22）。
- 替代方案：Storybook 取代展示頁（#502 已決用 gallery）；axios（違反 A6 的單一出口與 lint 規則）；date-fns（#502 已決 day.js）。
- 對應：system-design.md §目錄結構、§元件清單；ADR-005 D1、D3、D5。

### D3. 分層與 lint 規則以 ESLint flat config 落地

`frontend/eslint.config.js` 以 `eslint-plugin-boundaries` 宣告 `app`、`pages`、`features`、`components`、`api`、`lib`、`styles`、`build`、`test` 元素類型，只允許 F1 的 import 方向；功能之間互不 import，`pages` 只能 import 功能的 `index.ts`。另以 `no-restricted-imports`／`no-restricted-globals` 落地 system-design.md §額外的 ESLint 規則：`dayjs` 只在 `src/lib/date.ts`；`pages`／`features`／`components` 禁全域 `fetch` 與 `axios`；`msw`、`@faker-js/faker`、`src/test/**`、`*.msw.ts` 只准測試檔 import；`typescript-eslint` 的 `strictTypeChecked` 與 `no-explicit-any`；`react-hooks` 的 `rules-of-hooks` 與 `exhaustive-deps`。`src/api/generated/**` 不在 lint 範圍。唯一的具名例外是 `src/pages/dev-gallery/` 以 `?raw` 讀 `src/styles/theme.css`，規則檔以註解寫明理由（Q16）。

- 每條規則都附一個「故意違規」的驗證：在 apply 時以暫存檔確認 lint 會失敗再刪除，不留違規檔進版控。
- 對應：system-design.md §分層與允許的 import、§額外的 ESLint 規則；frontend-agent-rules F1、F2、F3、F10；clarification Q6、Q16。

### D4. `apiFetch` 是唯一出口，回傳 `{ data, meta }`；N3 是 apply 第一步

`src/api/mutator.ts` 的 `apiFetch` 是 Orval 的 mutator，處理順序（七種情況）依 system-design.md §唯一出口的處理順序，回傳形狀與 `ApiError` 欄位依 api-contract.md §唯一出口的回傳形狀、§錯誤正規化契約、§外層的判定規則。逾時 15 秒以 `src/lib/abort.ts` 的 `composeSignals` 合成呼叫端 signal 與逾時 signal；jsdom 與目標瀏覽器都支援 `AbortSignal.any` 後再改用標準 API（Q19 N6）。`ErrorType<E> = ApiError` 讓產生的 hook 的錯誤型別是 `ApiError`。

**N3 驗證**：產生的 hook 型別要靠 `ApiResponse<T>` 穿過 Orval 產物。apply 第一組在只有最小 `apiFetch` 與實際 Orval 版本的狀態下產生一次，以型別測試斷言 `useGetHealth().data` 為 `{ data: HealthData; meta: ResponseMeta }`、`error` 為 `ApiError`，且產生的 `getHealth` 沒有 Orval 加上的明確回傳型別註記。**驗證失敗是故障：停下來回到 clarification**，不在 apply 中改用 `input.override.transformer` 備案（它會讓產物與介面描述檔的形狀不一致）。

- 替代方案：攤平只回 `data`（丟掉畫面要的 traceId 與檢查時間，Q2 已否決）；回傳整個外層（呼叫端要自己判斷 `success`，違反 A7）。
- 對應：system-design.md §唯一出口的處理順序、§回傳形狀、§Orval 管線；api-contract.md §唯一出口的回傳形狀、§錯誤正規化契約；clarification Q2、Q4、Q19（C4、N6）。

### D5. Orval 管線與漂移檢查

`frontend/orval.config.ts`：input `../backend/openapi.json`；output `src/api/generated/`，`clean: true`，`client: 'react-query'`，`mock: true`（產出 `*.msw.ts`），`override.mutator` 指向 `src/api/mutator.ts` 的 `apiFetch`，`override.query.signal: true`。產物進版控；`frontend/src/api/generated/` 加進根目錄 `.prettierignore`；`.lintstagedrc.mjs` 的副檔名加上 `ts,tsx`。漂移的定義與檢查指令照 api-contract.md §什麼算漂移，識別字照 §產生的識別字。

- 替代方案：產物不進版控、建置時才產（審查看不到契約變化，A4 已否決）；讓 Prettier 格式化產物（每次重產都會出現格式差異，漂移檢查失準，Q8 已否決）。
- 對應：system-design.md §Orval 管線；api-contract.md §Orval 產生契約；clarification Q8。

### D6. TanStack Query 預設、路由與 providers

`src/app/query-client.ts` 的 `createQueryClient()` 設 `queries.retry: false`、`mutations.retry: false`，其他維持預設；`providers.tsx` 在模組層級建一個，測試每個測試建新的。`src/app/router.tsx` 以 `if (import.meta.env.DEV)` 才加入 `/dev/health`、`/dev/gallery` 兩條 `lazy` 路由與 `/`、`*` 的 `<Navigate replace>`；正式建置只剩空殼。`/dev/health` 的「只有首次載入與重新檢查顯示載入中」以 `isPending` 或「使用者觸發的 refetch 進行中」判定，背景更新不改變畫面（Q19 UI-7）。

- 替代方案：以環境變數旗標開關正式建置的開發頁（Q1 已否決）；Vite proxy（看不到 CORS 問題，system-design.md §本機開發的跨來源已否決）。
- 對應：system-design.md §TanStack Query 的預設值、§開發用路由、§本機開發的跨來源、§快取、生命週期與效能；clarification Q1、Q4、Q14。

### D7. 語系層放 `lib/i18n/`

`initI18n(navigator.language)` 以 `resolveLanguage` 決定 `zh-TW` 或 `en`，資源依 `common`、`systemHealth`、`devGallery` 三個 namespace 分檔；`getCurrentLanguage()` 給 `apiFetch` 當 `Accept-Language`。測試的 setup 預設 `zh-TW`，英文測試以 `changeLanguage('en')` 指定。鍵集一致以測試比對兩份語言檔。

- 替代方案：語系放 `app/`（`api/` 不能 import `app/`，違反 F1）；`Accept-Language` 固定 `zh-TW`（與介面語言不一致，Q5 已否決）。
- 對應：system-design.md §語系層、§目錄結構；clarification Q5。

### D8. Token 只經建置外掛取出，對照層只寫變數名

`frontend/build/extract-tokens.ts` 是 Vite 外掛，讀 `../design/prototype/assets/tokens.css`，只保留 `:root` 與 `html[data-theme="dark"]` 兩個規則中的 `--*` 宣告，以虛擬模組 `virtual:design-tokens.css` 提供給 `main.tsx`；檔案缺少時拋錯讓建置失敗；開發時把 tokens.css 加入 watch。`src/styles/theme.css` 只寫「語意變數 → tokens.css 變數名」與深色區塊，再以 `@theme inline` 接到 Tailwind；`src/styles/index.css` 宣告 `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`。對照清單照 ui-design.md §shadcn/ui 變數的對照、§shadcn 沒有對應語意的 token；對不到刻度的值照 §artifact 對不到刻度或 token 的值（Q17）。

- 替代方案：`@import` tokens.css 全檔（帶進外部字型與元素規則，並蓋過 Tailwind 同名變數，Q15 已否決）；把色值複製進 `theme.css`（兩份來源會漂移，違反 F6）。
- 對應：system-design.md §Token 對照層與 tokens.css 的引入；ui-design.md §元件與 design token；clarification Q9、Q13、Q15、Q17。

### D9. 原語以 shadcn CLI 加入並改為匯出 variant 陣列

`components/ui/` 只放 system-design.md §目錄結構 列的七個原語：Button、Input、Badge、Alert、Card、Skeleton 以 shadcn CLI 加入，Empty 依 `design/system/components/empty-state.md` 手寫為原語；Input 樣本的標籤用原生 `<label htmlFor>`，不另加 Label 原語，避免出現沒有展示區塊的第八個原語。有 variant 的原語匯出 `as const` 陣列（`buttonVariantValues`、`buttonSizeValues`、`badgeVariantValues`、`alertVariantValues`），`cva` 的 `variants` 由陣列建出。Button 刪掉 `link`、加入 `cta` 與 `loading`（`aria-busy` 與 `aria-disabled`，不用原生 `disabled`）。原語只用語意變數。

- 替代方案：以型別推導當宣告來源（完整性測試只能在型別層比對，Q9 已否決）；不改 shadcn 原語、另包一層（多一層抽象，F5 不鼓勵）。
- 對應：system-design.md §元件清單、§元件展示頁的完整性測試；ui-design.md §無障礙；clarification Q9、Q10。

### D10. 完整性測試兩層，計數由陣列算出

展示頁的目錄（`VariantCatalog`）以 `satisfies Record<ButtonVariant, Demo>` 綁定宣告；測試第 1 層在執行期比對目錄鍵與陣列，第 2 層 render 頁面查 `[data-gallery-item="<component>:<axis>:<value>"]`，並以 `import.meta.glob('/src/components/ui/*.tsx')` 確認每個原語都有區塊。區塊標頭的計數由陣列長度算出，不手寫。

- 對應：system-design.md §元件展示頁的完整性測試；clarification Q9、Q10、Q19（UI-4）。

### D11. 測試替身與覆蓋率

Vitest 用 jsdom；`src/test/setup.ts` 啟停 `msw/node` 的 `setupServer`（`onUnhandledRequest: 'error'`）並把語言設為 `zh-TW`；`src/test/envelope-fixtures.ts` 照 api-contract.md §MSW 四種狀態的 fixture 手組，以固定 fixture 覆寫產生的 handler（Q19 C1–C3）。逾時以假時鐘推進。`test:coverage` 以 `@vitest/coverage-v8` 產報告，排除 `src/api/generated/`、`src/test/`、設定檔，不設門檻；第一次數字記進 `acceptance.md`。

- 替代方案：真實後端跑整合測試（屬 #506 的 E2E）；在瀏覽器開發時用 MSW（Q6 已否決）。
- 對應：system-design.md §網路替身、§測試；api-contract.md §MSW 四種狀態的 fixture；clarification Q6、Q12、Q19。

### D12. `openspec/config.yaml` 的兩處修改

`operations.apply.guidance` 中「前端的檢查指令等 frontend/ 骨架 change（#505）建好再補進這一節」那一行改為實際的五條前端指令（D1 列出的 lint、typecheck、test／test:coverage、build、契約漂移檢查）；`rules.ui-design` 中前端架構的引用由 ADR-004 改為 ADR-005（clarification P1）。

- 對應：system-design.md §專案結構與要補進 `openspec/config.yaml` 的指令；clarification P1。

## Risks / Trade-offs

- [N3：Orval 為產生的請求函式加上明確回傳型別，`ApiResponse<T>` 穿不過產物] → apply 第 1 組先以實際版本驗證；失敗時停下來回到 clarification，不自行採用 `input.override.transformer` 備案。
- [`extractTokens` 讀 `frontend/` 之外的檔案，容器建置的 context 不含它就會失敗] → 外掛在檔案缺少時讓建置失敗並指出路徑；build context 的調整交給 #506（見 §跨 change 依賴）。
- [tokens.css 的結構改變（例如深色改用其他選擇器），外掛抽不到深色區塊] → 外掛測試以實際的 tokens.css 斷言兩個區塊都有 `--color-surface`；選擇器改變時測試失敗。
- [Orval 或 shadcn CLI 升版改變產物格式，造成大範圍漂移] → 版本由 lockfile 鎖定；升版是另一張 issue，漂移檢查會擋下未重產的提交。
- [`exactOptionalPropertyTypes` 不開，可選屬性的 `undefined` 檢查較寬] → Q19 N4 已接受；其他嚴格旗標照開。
- [ESLint boundaries 設定錯誤導致規則實際沒生效] → 每條規則在 apply 時以暫存的違規檔驗證會失敗（D3）。
- [開發頁顯示錯誤碼、traceId 與設定名] → Q11 已裁定為 07-01 的開發頁例外，且頁面只在開發模式存在（Q1）；建置後檢查 `dist/` 不含 `/dev/`。
- [覆蓋率不設門檻，數字可能下降而無人察覺] → Q12 已接受；基準記在 `acceptance.md`，門檻由 #506 或之後決定。

## Migration Plan

- 本次只新增 `frontend/`、`pnpm-workspace.yaml`，並修改 `pnpm-lock.yaml`、`.prettierignore`、`.lintstagedrc.mjs`、`openspec/config.yaml`；沒有資料庫 schema，也沒有 migration。
- 部署：本次沒有正式部署目標（容器與 Nginx 屬 #506）；正式建置的產出是空殼。
- 回滾：revert 本 change 的合併 commit。`pnpm-workspace.yaml` 與 lockfile 一起還原後，根目錄 `pnpm install --frozen-lockfile` 回到 #504 的狀態；`.prettierignore` 與 `.lintstagedrc.mjs` 的新增項目對沒有 `frontend/` 的 repo 無副作用。

### 跨 change 依賴（交給 #506，不在本 change 實作）

- 前端 Docker build context 必須包含 `design/prototype/assets/`，否則 `extractTokens` 讓建置失敗（D8）。
- `.env.example` 要有 `CORS_ALLOWED_ORIGINS=http://localhost:5173` 與 `VITE_API_BASE_URL=http://localhost:8000`。
- 正式建置不含開發頁（Q1），容器內的驗證改以後端 `/api/v1/health`，或把 E2E 跑在開發伺服器上。
- 根目錄串起「後端匯出 `openapi.json` → `pnpm --filter frontend api:generate`」的一條指令，以及 CI 的前端 job 與覆蓋率門檻。

### 本 change 不處理但需另開的工作

- Q9：`docs/development/architecture.mdx`「shadcn 元件不改寫」那句與 Q9 衝突，另開一張 `[Docs]` issue 改準；不列入本 change 的 tasks。

## Open Questions

無。所有會影響 specs、做法或任務拆解的問題已在 clarification Q1–Q19 決議；N3 是技術驗證，不是待決問題，處理方式見 D4 與 §Risks / Trade-offs。
