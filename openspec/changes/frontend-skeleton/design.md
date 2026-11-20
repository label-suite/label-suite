# Design

## Context

動機見 `proposal.md` §Why。本文只記實作前要定的技術決策；分層、類別、元件清單、處理順序與測試清單已寫在 `system-design.md`，畫面、文案與 token 落點已寫在 `ui-design.md`，回傳形狀、錯誤正規化、fixture 與 Orval 識別字已寫在 `api-contract.md`，這裡只指過去，不重抄。所有決策都依 `clarification.md` §決議 Q1–Q20（含 Q18 的補充決議；Q20 是 apply 第 1 組 N3 關卡回到停點後的決議），不重開。

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

新增 `pnpm-workspace.yaml`（`packages: [frontend]`，並以 `onlyBuiltDependencies: [esbuild, msw]` 明列允許執行安裝腳本的套件；pnpm 10 預設不執行依賴的安裝腳本，未列入時 esbuild 的平台執行檔與 msw 的安裝步驟不會執行），`frontend/package.json` 名稱 `frontend`、版本 `0.0.0`、`private: true`，依賴一律以 `pnpm --filter frontend add`（`-D`）加入，共用根目錄一份 `pnpm-lock.yaml` 與根目錄的 Prettier。`frontend/package.json` 的 script：`dev`、`build`（`vite build`）、`preview`、`lint`、`typecheck`（`tsc -b`）、`test`（`vitest run`）、`test:coverage`、`api:generate`（只跑 Orval）。

- 型別檢查只在 `typecheck`，`build` 不串 `tsc -b`：五條檢查指令各管一件事，建置失敗時不必再分辨是型別錯誤還是打包錯誤；每個群組提交前兩條都要跑（tasks 前言）。`tsconfig.json` 為 `noEmit`，`tsc -b` 的增量資訊以 `tsBuildInfoFile` 放在 `node_modules/.tmp/`，不在套件根目錄留下檔案。
- 替代方案：`frontend/` 獨立 pnpm 專案（第二份 lockfile、第二個 Prettier 版本、`setup.sh` 多一步）。不採，理由見 Q7。
- 根目錄 `.prettierignore` 加入 `frontend/src/api/generated/`（Q8）、`frontend/dist/`、`frontend/coverage/`：Prettier 只讀根目錄的 `.gitignore` 與 `.prettierignore`，不讀 `frontend/.gitignore`，不列入時本機產生的建置輸出與覆蓋率報告會讓 `pnpm format:check` 失敗。
- 版本號 `0.0.0` 是新套件的初始值，不是版本升級（Hard Rule 4 管的是既有版本號）。
- 對應：system-design.md §關鍵設計細節「專案結構與要補進 `openspec/config.yaml` 的指令」；clarification Q7。

### D2. 套件組合

執行期：`react`、`react-dom`（19）、`react-router-dom`（v6）、`@tanstack/react-query`、`i18next`、`react-i18next`、`dayjs`、`lucide-react`、`class-variance-authority`、`clsx`、`tailwind-merge`，以及 shadcn 原語需要的 Radix 套件（以 shadcn CLI 實際加入的為準）。shadcn CLI 不加進依賴，一律在根目錄以 `pnpm dlx shadcn@4.23.0 add <元件> --cwd frontend --yes` 執行：`--cwd` 是 shadcn CLI 自己的旗標，讓 CLI 讀 `frontend/components.json` 並寫進 `frontend/`（pnpm 的 `--dir` 不會改變 `dlx` 執行的 CLI 的工作目錄）；`--yes` 略過互動式確認，讓 agent 執行時不會卡在提示。版本寫死為確切版本（2026-11-20 的最新穩定版），同一個 change 內不換版本，避免不同時間加入的原語出自不同版本的範本。執行前以 `pnpm view shadcn@4.23.0 version` 確認該版本存在（輸出 `4.23.0`）；查不到就停下來回報，不改用其他版本。執行後 `git status --porcelain` 不得出現 `frontend/` 以外的新檔或修改。開發期：`vite`、`@vitejs/plugin-react`、`typescript`、`tailwindcss` 與 `@tailwindcss/vite`（v4）、`orval`、`msw`、`@faker-js/faker`、`vitest`、`@vitest/coverage-v8`、`jsdom`、`@testing-library/react`、`@testing-library/dom`、`@testing-library/user-event`、`@testing-library/jest-dom`、`eslint` 與 `typescript-eslint`、`eslint-plugin-boundaries`、`eslint-import-resolver-typescript`、`eslint-plugin-react-hooks`、`eslint-plugin-react-refresh`、`@types/node`、`@types/react`、`@types/react-dom`。

- CLI 會改寫 `components.json` 指向的 CSS 檔（寫入色值與 `:root` 變數），與 D8「對照層不寫色值」衝突：每次執行 CLI 後檢查 `src/styles/index.css` 與 `theme.css` 沒有 CLI 寫入的色值或 `:root` 區塊，有就移除，並由 4.2 的 `theme.test.ts` 與 5.1、5.2 的驗證擋下。
- 版本取 `pnpm add` 當下的最新穩定版並由 lockfile 鎖定；Node 版本與 CI 一致（22）。唯一例外是 `typescript` 寫死 `6.0.3`：`typescript-eslint` 8.73.0 的 peer 範圍是 `typescript <6.1.0`，取最新版會超出範圍；`typescript-eslint` 支援 6.1 之後再另開 issue 升版。
- `frontend/components.json` 的實際設定：`style: "new-york"`、`tailwind.baseColor: "neutral"`、`tailwind.config: ""`（Tailwind v4 沒有設定檔）、`tailwind.css: "src/styles/index.css"`、`cssVariables: true`、`iconLibrary: "lucide"`、`rsc: false`，`aliases` 指向 `@/components`、`@/components/ui`、`@/lib/utils`、`@/lib`。
- shadcn CLI 實際加入的 Radix 依賴是單一套件 `radix-ui`（原語以 `import { Slot } from "radix-ui"` 取用），不是個別的 `@radix-ui/react-*`。CLI 另會加入一個名為 `cn` 的套件並讓原語從它 import；apply 第 5 組兩次執行 CLI 後都移除該套件，原語改從 `@/lib/utils` import `cn()`（`components.json` 的 `aliases.utils` 與 D9 指定的位置），`frontend/package.json` 不含 `cn`。
- 規劃時沒列、apply 第 1 組實際需要而加入的開發依賴：`eslint-import-resolver-typescript`（`eslint-plugin-boundaries` 沒有它就解析不了 `@/` 路徑別名，跨層的 `@/` import 會被當成未知元素而漏檢）；`@testing-library/dom`（`@testing-library/react` 16 的 peer 依賴，不會自動安裝）；`@types/react`、`@types/react-dom`（React 19 不附型別宣告）。
- 替代方案：Storybook 取代展示頁（#502 已決用 gallery）；axios（違反 A6 的單一出口與 lint 規則）；date-fns（#502 已決 day.js）。
- 對應：system-design.md §目錄結構、§元件清單；ADR-005 D1、D3、D5。

### D3. 分層與 lint 規則以 ESLint flat config 落地

`frontend/eslint.config.js` 以 `eslint-plugin-boundaries` 宣告 `app`、`pages`、`features`、`components`、`api`、`lib`、`styles`、`build`、`test` 元素類型，只允許 F1 的 import 方向；功能之間互不 import，`pages` 只能 import 功能的 `index.ts`。另以 `no-restricted-imports`／`no-restricted-globals` 落地 system-design.md §額外的 ESLint 規則：`dayjs` 只在 `src/lib/date.ts`；`pages`／`features`／`components` 禁全域 `fetch` 與 `axios`；`msw`、`@faker-js/faker`、`src/test/**`，以及 Orval 產生的兩種測試替身檔只准測試檔 import：`*.msw.ts`（MSW handler）與 `*.faker.ts`（Orval 8 另外產出的假資料函式，import `@faker-js/faker`，由 `*.msw.ts` 重新匯出）；兩種都以 `**/*.msw`、`**/*.msw.ts`、`**/*.faker`、`**/*.faker.ts` 的 import 路徑樣式擋下，與 `@faker-js/faker` 套件本身的禁令並列；`typescript-eslint` 的 `strictTypeChecked` 與 `no-explicit-any`；`react-hooks` 的 `rules-of-hooks` 與 `exhaustive-deps`。`src/api/generated/**` 不在 lint 範圍。`src/main.tsx` 位於 `src/` 根層、不屬於任何元素資料夾，在 boundaries 設定中以檔案分類 `app-entry` 歸入 `app` 的放行規則（可 import 各層），否則 Vite 入口的 import 全被當成違規。`app` 的放行規則只列其他層（`app` 檔案之間互相 import 屬同一元素、不受檢查），而 `app-entry` 是檔案分類、不是 `app` 元素，所以另加一條 `app-entry` → `app` 的放行，讓 `main.tsx` 能 import `src/app/` 的 `App` 與 `createAppRouter`（apply 第 8 組補上）。唯一的具名例外是 `src/pages/dev-gallery/` 以 `?raw` 讀 `src/styles/theme.css`，規則檔以註解寫明理由（Q16）。

- 「測試檔」的定義在規則檔中只寫一次、各條規則共用：`**/*.test.ts`、`**/*.test.tsx`、`src/test/**`、`vitest.config.ts`。產品碼是這組 glob 以外的 `src/**` 與 `build/**`。
- 測試檔對 `app` 層的唯一放行：測試檔（上面那組 glob）可以 import `src/app/query-client.ts`，讓整合測試以正式的 `createQueryClient()` 建 client、與正式執行同一組預設（6.2、6.3）；`app` 的其他檔案仍不開放，產品碼的 `features`、`pages` 仍不得 import `app`。測試檔不進 bundle，所以不影響 F1 對產品碼的約束（apply 第 6 組補上）。
- 每條規則都附一個「故意違規」的驗證：在 apply 時以暫存檔確認 lint 會失敗再刪除，不留違規檔進版控。
- 對應：system-design.md §分層與允許的 import、§額外的 ESLint 規則；frontend-agent-rules F1、F2、F3、F10；clarification Q6、Q16。

### D4. `apiFetch` 是唯一出口，回傳 `{ data, meta }`；N3 是 apply 第一步

`src/api/mutator.ts` 的 `apiFetch` 是 Orval 的 mutator，處理順序（七種情況）依 system-design.md §唯一出口的處理順序，回傳形狀與 `ApiError` 欄位依 api-contract.md §唯一出口的回傳形狀、§錯誤正規化契約、§外層的判定規則。逾時 15 秒以 `src/lib/abort.ts` 的 `composeSignals(caller: AbortSignal | undefined, timeoutMs)` 合成呼叫端 signal 與逾時計時器（只收一個可選的呼叫端 signal 加毫秒數，不是任意多個 signal），回傳 `{ signal, cleanup, reason }`：`reason()` 回傳先觸發的來源 `"caller"`、`"timeout"`，尚未中止時為 `null`；`apiFetch` 在 `fetch` 被拒絕時以它分辨 `aborted`、`timeout` 與 `network`，`cleanup()` 在 `finally` 清掉計時器與監聽。jsdom 與目標瀏覽器都支援 `AbortSignal.any` 後再改用標準 API（Q19 N6）。

`src/api/config.ts` 的 `readApiConfig(env: ApiEnv = import.meta.env)` 以自訂的 `ApiEnv` 介面接收環境變數（`VITE_API_BASE_URL` 與其他鍵都型別為 `unknown`，`import.meta.env` 可直接傳入），不以 Vite 的 `ImportMetaEnv` 當參數型別：`ImportMetaEnv` 的索引簽章是 `any`，`strictTypeChecked` 的 `no-unsafe-*` 會擋下，且讀到的值本來就要在執行期驗證型別。

`mutator.ts` 的型別斷言只有三處，都附註解：成功時的 `{ data, meta } as ApiResponse<T>` 與 `204` 的 `undefined as ApiResponse<T>`（`ApiResponse<T>` 是條件型別，泛型 `T` 未定時 TypeScript 無法把具體值收窄進去；`data` 內層依 api-contract §外層的判定規則 以型別信任產物），以及 `JSON.parse(text) as unknown`（把 `JSON.parse` 的 `any` 立刻轉為 `unknown`，再交給外層判定收窄）。`ErrorType<_E> = ApiError` 讓產生的 hook 的錯誤型別是 `ApiError`。這一行是 `mutator.ts` 唯一的具名 lint 例外：Orval 的 mutator 介面要求這個型別參數，但結果不依賴它，所以參數名加底線並以一行 `eslint-disable-next-line @typescript-eslint/no-unused-vars` 附理由關掉；改名為 `E` 則改由 tsc 的 `noUnusedParameters`（TS6133）報錯，兩條規則只能擇一放行。

組網址抽成 `src/api/mutator.ts` 匯出的純函式 `buildRequestUrl(baseUrl, url, params)`（system-design.md §唯一出口的處理順序 第 1 步）：`baseUrl` 為空時回傳相對路徑（例如 `/api/v1/health`），否則回傳 `baseUrl` 加 `url`。spec `frontend-api-client`「基底網址為空時以同源相對路徑送出」直接斷言這個函式的回傳值，不經 MSW：Node 的 `fetch` 不接受相對網址，jsdom 也不會替 `fetch` 補上來源，經 MSW 測相對網址只會測到測試環境。其餘經 `apiFetch` 的測試一律在 `VITE_API_BASE_URL=http://localhost:8000` 下以絕對網址進行（見 D11）。

**N3 驗證**：產生的 hook 型別要靠 `ApiResponse<T>` 穿過 Orval 產物。apply 第一組在只有最小 `apiFetch` 與實際 Orval 版本的狀態下產生一次，以型別測試斷言 `useGetHealth().data` 為 `{ data: HealthData; meta: ResponseMeta }`、`error` 為 `ApiError`，且產生的 `getHealth` 沒有 Orval 加上的明確回傳型別註記。**驗證失敗是故障：停下來回到 clarification**，不在 apply 中改用 `input.override.transformer` 備案（它會讓產物與介面描述檔的形狀不一致）。

第一次驗證（Orval 8.48.0、未指定 `httpClient`）失敗：產物是 fetch 式呼叫並帶明確回傳型別，`ApiResponse<T>` 傳不到 hook。依 clarification Q20 改以 `httpClient: "axios"` 產生（見 D5），重產後 `getHealth` 為 `apiFetch<HealthDataResponse>({ url, method, signal }, options)`、沒有回傳註記。型別測試的兩個寫法要求：

- hook 經一層包裝 `const useHealthQuery = () => useGetHealth()` 取型別，讓泛型 `TData` 取預設值；斷言寫成 `expectTypeOf(useHealthQuery).returns.toHaveProperty("data").toEqualTypeOf<...>()`（`error` 同理），不另立型別別名。直接寫 `ReturnType<typeof useGetHealth>` 時，hook 的泛型 `TData` 沒有呼叫端可推導，會被代成 `unknown`，斷言測到的是 TypeScript 的泛型代入而不是產物（Q20 記為測試寫法錯誤，不是產物問題）。包裝函式以 `use` 開頭命名，否則 `react-hooks/rules-of-hooks` 會把其中的 hook 呼叫判為違規；它直接交給 `expectTypeOf`，不只當型別使用，否則 `no-unused-vars` 會報錯。它只被檢視型別、不會執行。
- `expectTypeOf` 的斷言只在型別層成立：Vitest 執行期只跑過呼叫、不比對型別，型別不符時是 `typecheck`（`tsc -b`）報錯。所以 N3 的通過條件是 `test` 與 `typecheck` 兩條都以 0 結束，只跑其中一條不算驗證過。

- 替代方案：攤平只回 `data`（丟掉畫面要的 traceId 與檢查時間，Q2 已否決）；回傳整個外層（呼叫端要自己判斷 `success`，違反 A7）。
- 對應：system-design.md §唯一出口的處理順序、§回傳形狀、§Orval 管線；api-contract.md §唯一出口的回傳形狀、§錯誤正規化契約；clarification Q2、Q4、Q19（C4、N6）。

### D5. Orval 管線與漂移檢查

`frontend/orval.config.ts`：input `../backend/openapi.json`；output `src/api/generated/`，`clean: true`，`client: 'react-query'`，`httpClient: 'axios'`，`mock: true`（產出 `*.msw.ts` 的 MSW handler 與 `*.faker.ts` 的假資料函式，後者由前者重新匯出），`override.mutator` 指向 `src/api/mutator.ts` 的 `apiFetch`，`override.query.signal: true`。

- `httpClient: 'axios'` 只決定 Orval 產生的呼叫形狀：呼叫函式以 `apiFetch<T>({ url, method, params, data, signal }, options)` 呼叫 mutator、不加明確回傳型別，`ApiResponse<T>` 才能經 mutator 的回傳型別傳到 hook（D4 的 N3）。產物不 import `axios`，`axios` 不加進依賴，D3 在 `pages`／`features`／`components` 禁用 `axios` 的規則不變；實際送出請求的仍是 `apiFetch` 內的 `fetch`。理由：這個形狀與 api-contract.md 原本寫的完全一致，其他設計不必改（clarification Q20）。
- 替代方案（Q20）：不指定 `httpClient`、改用 Orval 的 fetch 式介面（產物帶 `{ data, status, headers }` 的明確回傳型別，要重寫 `{ data, meta }` 的設計）；`input.override.transformer`（規劃已排除，見 D4）。
- 產生的 MSW handler 以 `'*/api/v1/health'` 比對（開頭萬用字元，任何來源都會命中），不是絕對網址；測試中的覆寫方式見 D11。產物進版控；`frontend/src/api/generated/` 加進根目錄 `.prettierignore`；`.lintstagedrc.mjs` 的副檔名加上 `ts,tsx`。漂移的定義與檢查指令照 api-contract.md §什麼算漂移，識別字照 §產生的識別字。

- 替代方案：產物不進版控、建置時才產（審查看不到契約變化，A4 已否決）；讓 Prettier 格式化產物（每次重產都會出現格式差異，漂移檢查失準，Q8 已否決）。
- `src/api/mutator.ts` 的 `ErrorType<_E>` 帶一行附理由的 `eslint-disable-next-line @typescript-eslint/no-unused-vars`，是 Orval 要求型別參數造成的具名例外，理由見 D4。
- 對應：system-design.md §Orval 管線；api-contract.md §Orval 產生契約；clarification Q8、Q20。

### D6. TanStack Query 預設、路由與 providers

`src/app/query-client.ts` 的 `createQueryClient()` 設 `queries.retry: false`、`mutations.retry: false`，其他維持預設；`providers.tsx` 在模組層級建一個，測試每個測試建新的。`src/app/router.tsx` 以 `if (import.meta.env.DEV)` 才加入 `/dev/health`、`/dev/gallery` 兩條 `lazy` 路由與 `/`、`*` 的 `<Navigate replace>`；正式建置只剩空殼。`/dev/health` 的載入中判定為「`isPending`」或「使用者按下『重新檢查』後 `isFetching` 為真」：元件以一個旗標記住這次取資料是使用者觸發的，`isFetching` 轉為假時清除；背景更新（`isFetching` 為真但旗標為假）不顯示載入中，畫面維持前一個結果（Q19 UI-7、api-contract.md §畫面狀態對照的「載入中」列）。旗標以元件狀態保存，清除放在監看 `isFetching` 的 `useEffect`（`isFetching` 轉為假時設回假），不在 `refetch()` 的 promise 回呼中清除。只要 `isFetching` 為真（含背景更新），「重新檢查」就帶 `aria-disabled="true"` 並忽略點擊與 Enter／Space，所以不會在請求進行中呼叫 `refetch()`；停用判定抽成 `to-health-view-state.ts` 匯出的純函式 `isRecheckDisabled(query)`（只看 `isFetching`），與 `toHealthViewState` 分開測試；TanStack Query 的 `refetch()` 預設 `cancelRefetch: true`，請求進行中再呼叫會中止進行中的請求再重送，這個擋法讓它永遠不會被觸發。`toHealthViewState` 的判定順序固定為：先看 `aborted`（回傳 `null`），再判定載入中，最後依成功資料或錯誤對應畫面狀態（tasks 6.1）。遇到 `kind` 為 `aborted` 的錯誤回傳 `null`，面板收到 `null` 時維持前一次渲染的畫面狀態（首次載入就被取消時維持載入中）；面板以 `useRef` 保存每次渲染後的畫面狀態（初值為載入中），收到 `null` 時改用它。取消只發生在元件卸載或查詢被取代時，不需要專屬畫面。`toHealthViewState` 是純函式、不做格式化也不翻譯：`ok` 狀態的 `checkedAt` 保留 `meta.timestamp` 的 ISO 8601 字串，由面板渲染時呼叫 `formatDevCheckTime`（D12）轉成顯示文字，所以只有面板依賴 `src/lib/date.ts`。

`App` 以 `router` prop 接收路由（`<App router={createAppRouter()} />` 由 `src/main.tsx` 建立），不在 `App` 內自建，測試可以傳入 memory router。正式模式的路由為 `[{ path: "*", element: null }]`：每個路徑都渲染空內容，空的 route 陣列會讓 React Router 顯示它內建的 404 畫面，不符合「正式建置只有空殼」。因為開發分支整段被剪除，正式建置只產出一個 JavaScript chunk，沒有開發頁的 lazy chunk。

- 替代方案：以環境變數旗標開關正式建置的開發頁（Q1 已否決）；Vite proxy（看不到 CORS 問題，system-design.md §本機開發的跨來源已否決）。
- 對應：system-design.md §TanStack Query 的預設值、§開發用路由、§本機開發的跨來源、§快取、生命週期與效能；clarification Q1、Q4、Q14。

### D7. 語系層放 `lib/i18n/`

`initI18n(navigator.language)` 以 `resolveLanguage` 決定 `zh-TW` 或 `en`，資源依 `common`、`systemHealth`、`devGallery` 三個 namespace 分檔（`src/lib/i18n/locales/<語言>/<namespace>.json`）；`getCurrentLanguage()` 給 `apiFetch` 當 `Accept-Language`。i18next 以 `fallbackLng: false` 初始化：查不到的鍵不退回另一種語言，畫面直接出現翻譯鍵；`zh-TW` 與 `en` 的鍵集由 `locales.test.ts` 保證一致，退回機制只會掩蓋缺鍵，並讓「開發頁載入前查不到 `systemHealth`」的斷言失去意義。

- **載入時機**：`initI18n` 只載入 `common`。`systemHealth` 由 `src/features/system-health/index.ts` 在模組載入時以 `i18n.addResourceBundle` 為兩種語言註冊，`devGallery` 由 `src/pages/dev-gallery/` 的入口同樣註冊；兩者只被開發模式的 `lazy` 路由 import（D6），所以語言檔隨開發頁的 chunk 一起載入，正式建置以 `import.meta.env.DEV` 剪除路由時連同語言檔一起剪除。註冊包成 `src/lib/i18n/` 匯出的 `registerNamespace(namespace, resources)`，重複註冊不報錯（`deep` 與 `overwrite` 皆為 `true`）。
- **`common` 的內容限制**：只放跨頁共用的文字（例如瀏覽器標題的格式「Label Suite — {{page}}」），不放眉標、頁名或任何含 `/dev/` 的字串；頁名與眉標放在各頁的 namespace，否則 8.2 在 `dist/` 搜尋 `/dev/health`、`/dev/gallery` 會找到。
- **測試**：`src/test/setup.ts` 只以 `zh-TW` 呼叫 `initI18n`（只有 `common`），不註冊 `systemHealth`、`devGallery`；feature 與 page 的測試一律從對外入口 import（`features/system-health/index.ts`、`pages/dev-gallery` 的入口），入口在模組載入時註冊自己的 namespace，與正式執行的註冊路徑相同。這樣「`initI18n` 後查不到 `systemHealth`」（2.3）與「開啟 `/dev/health` 前查不到 `systemHealth`」（8.1）在測試中仍成立；英文測試以 `changeLanguage('en')` 指定。鍵集一致測試（`src/lib/i18n/locales.test.ts`）以 `import.meta.glob('./locales/*/*.json', { eager: true })` 直接讀語言檔比對，不經 i18next 實例，所以不受註冊時機影響。

- 替代方案：語系放 `app/`（`api/` 不能 import `app/`，違反 F1）；`initI18n` 一次載入三個 namespace（開發頁的文字與 `/dev/` 字串會進正式 bundle，違反 Q1）；i18next 的 backend 外掛以 HTTP 載入語言檔（多一個請求與失敗狀態，健康檢查頁「只呼叫健康檢查端點」也不再成立）；`Accept-Language` 固定 `zh-TW`（與介面語言不一致，Q5 已否決）。
- 對應：system-design.md §語系層、§目錄結構；clarification Q5。

### D8. Token 只經建置外掛取出，對照層只寫變數名

`frontend/build/extract-tokens.ts` 是 Vite 外掛，讀 `../design/prototype/assets/tokens.css`，只保留 `:root` 與 `html[data-theme="dark"]` 兩個規則中的 `--*` 宣告，以虛擬模組 `virtual:design-tokens.css` 提供給 `main.tsx`；檔案缺少時拋錯讓建置失敗；開發時把 tokens.css 加入 watch。`src/styles/theme.css` 只寫「語意變數 → tokens.css 變數名」與深色區塊，再以 `@theme inline` 接到 Tailwind；`src/styles/index.css` 宣告 `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`。對照清單照 ui-design.md §shadcn/ui 變數的對照、§shadcn 沒有對應語意的 token；對不到刻度的值照 §artifact 對不到刻度或 token 的值（Q17）。

**同名變數的碰撞**：Tailwind v4 的 `@theme inline` 以 `--color-<名稱>` 宣告色彩（例如 `--color-primary: var(--primary)`、`--color-border: var(--border)`、`--color-success: var(--success)`），這些名稱與 tokens.css 的 `--color-primary`、`--color-border`、`--color-success`、`--color-secondary`、`--color-accent`、`--color-cta`、`--color-warning`、`--color-info` 等同名。Tailwind 若把這些宣告輸出到 `:root` 並勝過 token，token 的值會被改寫成語意變數，而 `--border: var(--color-border)` 這類對照會形成循環參照、整個變數失效。處理方式：取出的 token 以一般（不在 `@layer` 內）樣式引入，Tailwind 的主題變數位於 `@layer theme`，不在層內的宣告必定勝過層內宣告；並以測試守住兩件事：`extract-tokens.test.ts` 斷言取出的結果不含 `@layer`，`theme.test.ts` 列出 `@theme inline` 中與 tokens.css 同名的 `--color-*` 鍵並與測試內明列的已知清單比對，新增碰撞時測試失敗、要人確認後更新清單。瀏覽器中的實際結果由 spec `design-token-mapping`「token 檔的變數值不被對照層覆寫」的人工驗收確認。

apply 時落定的細節：

- `theme.css` 除 ui-design.md 兩張對照表列的變數外，另有原語實際用到的語意變數：`--destructive-foreground`、`--cta-foreground`、`--cta-hover`、`--primary-border`、`--success`／`--warning`／`--error`／`--info` 各自的 `-bg` 與 `-border`、`--error`、`--control-disabled`、`--card-shadow`，一樣只指向 tokens.css 的變數名。
- `html[data-theme="dark"]` 區塊保留但為空：tokens.css 在深色下已重新定義同名 token，現有語意變數照原對照即跟著換；只有深色要指向「不同 token」的語意變數才寫進這裡，ui-design.md 目前沒有這種變數。
- Skeleton 的骨架條用 `bg-border`（`--border`），不用 `bg-muted`。
- Vitest 預設把所有 CSS import（含 `?raw`）清成空字串，所以 `vitest.config.ts` 設 `css: { include: [/\.css\?raw$/] }`，讓讀文字的測試（`theme.test.ts`、展示頁的 Token 對照）拿到真內容，一般 CSS import 仍為空。
- `extract-tokens.test.ts` 以 `// @vitest-environment node` 在 node 環境執行（外掛讀檔、跑在建置端，不需要 DOM）。
- `vitest.config.ts` 以 `import viteConfig from "./vite.config.ts"` 帶 `.ts` 副檔名 import：不帶副檔名時 Vite 的原生設定載入器在每次測試都警告不支援；`tsconfig` 已開 `allowImportingTsExtensions`，行為不變。

- 替代方案：`@import` tokens.css 全檔（帶進外部字型與元素規則，並蓋過 Tailwind 同名變數，Q15 已否決）；把色值複製進 `theme.css`（兩份來源會漂移，違反 F6）。
- 對應：system-design.md §Token 對照層與 tokens.css 的引入；ui-design.md §元件與 design token；clarification Q9、Q13、Q15、Q17。

### D9. 原語以 shadcn CLI 加入並改為匯出 variant 陣列

`components/ui/` 只放 system-design.md §目錄結構 列的七個原語：Button、Input、Badge、Alert、Card、Skeleton 以 shadcn CLI 加入，Empty 依 `design/system/components/empty-state.md` 手寫為原語；Input 樣本的標籤用原生 `<label htmlFor>`，不另加 Label 原語，避免出現沒有展示區塊的第八個原語。有 variant 的原語匯出 `as const` 陣列（`buttonVariantValues`、`buttonSizeValues`、`badgeVariantValues`、`alertVariantValues`），`cva` 的 `variants` 由陣列建出。Button 刪掉 `link`、加入 `cta` 與 `loading`（`aria-busy` 與 `aria-disabled`，不用原生 `disabled`）。原語只用語意變數。

`Object.fromEntries` 回傳 `{ [k: string]: T }`，所以 Button、Badge、Alert 三處以 `as Record<V, string>` 收回 variant 鍵型別；斷言前的 class 對照物件以 `satisfies Record<V, string>` 檢查，鍵缺漏或多出時 `tsc` 仍會報錯，斷言不放寬檢查。字級與間距的 token 沒有接成 Tailwind 主題刻度，原語以 Tailwind v4 的 arbitrary value 直接引用變數，例如 `text-(length:--text-caption)`、`px-(--space-lg)`；色彩仍走 `@theme inline` 接好的語意 class。

- 替代方案：以型別推導當宣告來源（完整性測試只能在型別層比對，Q9 已否決）；不改 shadcn 原語、另包一層（多一層抽象，F5 不鼓勵）。
- 對應：system-design.md §元件清單、§元件展示頁的完整性測試；ui-design.md §無障礙；clarification Q9、Q10。

### D10. 完整性測試兩層，計數由陣列算出

展示頁的目錄（`VariantCatalog`）以 `satisfies Record<ButtonVariant, Demo>` 綁定宣告；測試第 1 層在執行期比對目錄鍵與陣列，第 2 層 render 頁面查 `[data-gallery-item="<component>:<axis>:<value>"]`，並以 `import.meta.glob(['/src/components/ui/*.tsx', '!/src/components/ui/*.test.tsx'])` 列出原語檔案（排除原語自己的測試檔），對下表查出每個檔案應對應的區塊 `id`，斷言頁面上有該 `section`。表中查不到的檔名直接讓測試失敗，訊息含檔名。區塊標頭的計數由陣列長度算出，不手寫。

| 原語檔案       | 區塊 `id` |
| -------------- | --------- |
| `button.tsx`   | `button`  |
| `input.tsx`    | `input`   |
| `badge.tsx`    | `badge`   |
| `alert.tsx`    | `alert`   |
| `card.tsx`     | `card`    |
| `skeleton.tsx` | `states`  |
| `empty.tsx`    | `states`  |

對應是多對一：`skeleton.tsx` 與 `empty.tsx` 共用「Skeleton · Empty」區塊（ui-design.md §元件樹 `/dev/gallery` 的 `#states`）。`tokens` 區塊沒有對應的原語檔案，不在表內。這張表放在測試檔中，是新增原語時唯一要同步的地方。

`data-gallery-item` 實際使用的維度：Button 為 `button:variant:<v>`、`button:size:<v>`、`button:state:<v>`；Input 為 `input:state:<v>`；Badge、Alert 為 `<component>:variant:<v>`；Card 為 `card:part:header|content|footer`；沒有 variant 的 Skeleton、Empty 各一個樣本 `skeleton:sample:lines`、`empty:sample:panel`。Button、Badge、Alert、Input 的樣本可見文字是值名稱；Card、Skeleton、Empty 的可見文字是樣本內容（標題、說明文字），不是值名稱。目錄的 `catalogEntries` 以 `Object.entries<Demo>(demos) as [Value, Demo][]` 收回鍵型別（`Object.entries` 的鍵一律是 `string`，目錄本身已由 `satisfies` 綁定）。

Token 對照的色塊用靜態的語意 class（每列對照到固定的 `bg-*` class），不以字串組出 class 名稱，因為 Tailwind 只產生原始碼中完整出現的 class；解析 `theme.css` 的是 `pages/dev-gallery/theme-mapping.ts` 的 `parseApprovedMappings`。左側目錄連結在 `location.hash` 等於該錨點時設 `aria-current="location"`，網址沒有 hash 時沒有任何連結標示。

主題切換（7.2）只改 `<html data-theme>`；元件卸載時把它還原為 `light`，深色不會帶到同一分頁的 `/dev/health`（ui-design.md §元件樹 主題切換；clarification Q13）。

- 對應：system-design.md §元件展示頁的完整性測試；clarification Q9、Q10、Q19（UI-4）。

### D11. 測試替身與覆蓋率

Vitest 用 jsdom；`vitest.config.ts` 的 `test.env` 設 `VITE_API_BASE_URL=http://localhost:8000`，測試中的 `apiFetch` 一律送絕對網址；基底網址為空的情況只以 `buildRequestUrl` 的單元測試涵蓋（D4）。

網址比對分兩種：產生的 handler（`src/test/msw-server.ts` 以它們作為預設）比對 `'*/api/v1/health'`，任何來源都命中；手組的 fixture handler 比對絕對網址 `http://localhost:8000/api/v1/health`。測試以 `server.use(<fixture handler>)` 加入 fixture，MSW 讓 `use()` 加入的 handler 排在預設 handler 之前先比對，所以兩者都命中時由 fixture 回應；覆寫靠的是比對順序，不是網址不同。因為預設 handler 用萬用字元，送錯來源的請求會落到產生的 handler 回傳假資料，而不是觸發未處理請求的錯誤（MSW 3 把 `onUnhandledRequest` 改名為 `onUnhandledFrame`，程式用後者，見下）；要驗證送出網址的測試（spec `frontend-api-client` 的請求內容 Scenario）在 handler 內記下並斷言 `request.url` 等於 `http://localhost:8000/api/v1/health`，不靠未處理請求的錯誤。`src/test/setup.ts` 在 1.1 先建立為空檔並掛上 `setupFiles`，3.3 補齊：啟停 `msw/node` 的 `setupServer`（`onUnhandledFrame: 'error'`；規劃時寫的 `onUnhandledRequest` 是 MSW 2 的名稱，MSW 3 改名為 `onUnhandledFrame`，本文與 tasks、system-design、api-contract 中出現的 `onUnhandledRequest` 都指這個選項），每個測試後呼叫 Testing Library 的 `cleanup()`（`afterEach(cleanup)`，Vitest 未開 globals，Testing Library 不會自動清理 DOM），並把語言設為 `zh-TW`；`src/test/envelope-fixtures.ts` 照 api-contract.md §MSW 四種狀態的 fixture 手組，以固定 fixture 覆寫產生的 handler（Q19 C1–C3）。逾時以假時鐘推進。

apply 時落定的測試細節：

- `credentials: 'include'` 以 `vi.spyOn(globalThis, "fetch")` 讀 `fetch` 收到的 init 斷言：MSW 攔截後重建的 `Request` 不保留 credentials 模式，在 handler 內讀不到。
- `api/generated-contract.test.ts` 自建 `new QueryClient({ defaultOptions: { queries: { retry: false } } })`，不 import `app/query-client.ts`（寫這個測試時 F1 還不允許 `api` → `app`；之後 D3 已放行測試檔 import `app/query-client.ts`）。
- 401、403 的測試用 `TEST_PLACEHOLDER_401`、`TEST_PLACEHOLDER_403` 當錯誤碼：`openapi.json` 目前沒有這兩個狀態的錯誤碼，佔位值保留到 01-01 定義錯誤碼為止，屆時換成正式值。

`test:coverage` 以 `@vitest/coverage-v8` 產報告，排除 `src/api/generated/`、`src/test/`、設定檔，不設門檻；第一次數字記進 `acceptance.md`。

- 替代方案：真實後端跑整合測試（屬 #506 的 E2E）；在瀏覽器開發時用 MSW（Q6 已否決）；測試中把基底網址留空、以 jsdom 的 `location` 補成絕對網址（要另外替換全域 `fetch`，測到的是替換層而不是 `apiFetch`）。
- 對應：system-design.md §網路替身、§測試；api-contract.md §MSW 四種狀態的 fixture；clarification Q6、Q12、Q19。

### D12. 日期依裝置時區顯示

`src/lib/date.ts` 是 day.js 的唯一入口（`utc`、`timezone` 外掛），只匯出 `formatDevCheckTime(value, timeZone?)` 一個函式，把 ISO 8601 UTC 時間點格式化為 `YYYY-MM-DD HH:mm:ss（UTC±H）`；業務頁的 `YYYY-MM-DD HH:mm` 不在本次範圍（spec `date-time-display`），所以不匯出業務格式、目前時間或可替換的時鐘。時區參數可選，未指定時取裝置時區 `Intl.DateTimeFormat().resolvedOptions().timeZone`；括號內是該時間點在該時區的實際偏移（整點為 `UTC+8`、`UTC-5`、`UTC+0`，非整點為 `UTC+5:30`）。不寫死 `Asia/Taipei` 或任何時區，所以不需要 F10 的例外。

- 測試以時區參數注入 `Asia/Taipei`、`America/New_York`、`UTC`、`Asia/Kolkata`；「未指定時採用裝置時區」以 `vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')` 包住原實作、只覆寫回傳的 `timeZone` 模擬裝置時區。不替換 `Intl.DateTimeFormat` 建構式（day.js 的 timezone 外掛靠它的 `formatToParts` 換算，替換會讓換算失效），也不靠改 `TZ` 環境變數，結果不受測試機時區影響。
- 健康檢查頁的 integration 測試用同一個 spy 把裝置時區設為 `Asia/Taipei`，讓「檢查時間」的期望值固定；面板不提供時區 prop，與正式執行同樣走「未指定時取裝置時區」。需要固定「現在」的測試以 `vi.setSystemTime` 處理，`date.ts` 不提供時鐘注入。
- 替代方案：一律換算 `Asia/Taipei`（違反 F10 與 07-01，Q18 補充決議已否決）；以 `Date.prototype.toLocaleString` 自行組字串（偏移字串要自己算，且格式依執行環境的 ICU 版本而異）。
- 對應：ui-design.md §文案（檢查時間）；frontend-agent-rules F10；clarification Q18 與其補充決議。

### D13. `openspec/config.yaml` 的兩處修改

`operations.apply.guidance` 中「前端的檢查指令等 frontend/ 骨架 change（#505）建好再補進這一節」那一行改為實際的五條前端指令（D1 列出的 lint、typecheck、test／test:coverage、build、契約漂移檢查）；`rules.ui-design` 中前端架構的引用由 ADR-004 改為 ADR-005（clarification P1）。

- 對應：system-design.md §專案結構與要補進 `openspec/config.yaml` 的指令；clarification P1。

## Risks / Trade-offs

- [N3：Orval 為產生的請求函式加上明確回傳型別，`ApiResponse<T>` 穿不過產物] → apply 第 1 組先以實際版本驗證；失敗時停下來回到 clarification，不自行採用 `input.override.transformer` 備案。第一次驗證已失敗並回到停點，clarification Q20 決議以 `httpClient: 'axios'` 產生（D5）；Orval 升版時 1.3 的型別測試會再擋一次。
- [`extractTokens` 讀 `frontend/` 之外的檔案，容器建置的 context 不含它就會失敗] → 外掛在檔案缺少時讓建置失敗並指出路徑；build context 的調整交給 #506（見 §跨 change 依賴）。
- [tokens.css 的結構改變（例如深色改用其他選擇器），外掛抽不到深色區塊] → 外掛測試以實際的 tokens.css 斷言兩個區塊都有 `--color-surface`；選擇器改變時測試失敗。
- [Orval 或 shadcn CLI 升版改變產物格式，造成大範圍漂移] → 版本由 lockfile 鎖定；升版是另一張 issue，漂移檢查會擋下未重產的提交。
- [`exactOptionalPropertyTypes` 不開，可選屬性的 `undefined` 檢查較寬] → Q19 N4 已接受；其他嚴格旗標照開。
- [ESLint boundaries 設定錯誤導致規則實際沒生效] → 每條規則在 apply 時以暫存的違規檔驗證會失敗（D3）。
- [Orval 的 mock 輸出多出規劃沒預期的檔案（8 版的 `*.faker.ts`），測試替身的 lint 規則沒涵蓋] → tasks 1.4 補上 `*.faker.ts` 的規則與違規檔驗證；8.2 在 `dist/` 搜尋假資料產生器的特有字串，規則漏網時建置檢查仍會擋下。
- [`typescript` 寫死 6.0.3，不隨 `pnpm add` 取最新] → 受 `typescript-eslint` 的 peer 範圍限制（D2）；升版另開 issue。
- [開發頁顯示錯誤碼、traceId 與設定名] → Q11 已裁定為 07-01 的開發頁例外，且頁面只在開發模式存在（Q1）；建置後檢查 `dist/` 不含 `/dev/health`、`/dev/gallery` 與開發頁語言檔的文字（D7）。
- [`@theme inline` 的 `--color-*` 與 tokens.css 同名，token 被改寫或形成循環參照] → token 以不在層內的樣式引入，測試守住「取出結果不含 `@layer`」與同名清單（D8）；瀏覽器中的計算值由人工驗收確認。
- [shadcn CLI 把色值與 `:root` 變數寫進樣式檔] → 版本寫死，每次執行後檢查並移除，`theme.test.ts` 擋下色值（D2）。
- [開發頁的 namespace 在模組載入時才註冊，測試若直接 import 內部檔案而不經入口，會拿到翻譯鍵本身] → feature 與 page 的測試一律從對外入口 import，畫面上出現翻譯鍵時斷言失敗；鍵集一致測試直接讀語言檔（D7）。
- [覆蓋率不設門檻，數字可能下降而無人察覺] → Q12 已接受；基準記在 `acceptance.md`，門檻由 #506 或之後決定。

## Migration Plan

- 本次只新增 `frontend/`、`pnpm-workspace.yaml`，並修改 `pnpm-lock.yaml`、`.prettierignore`（`frontend/src/api/generated/`、`frontend/dist/`、`frontend/coverage/`）、`.lintstagedrc.mjs`、`openspec/config.yaml`；沒有資料庫 schema，也沒有 migration。
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

無。所有會影響 specs、做法或任務拆解的問題已在 clarification Q1–Q20 決議；N3 的第一次驗證失敗已由 Q20 決議處理，見 D4、D5 與 §Risks / Trade-offs。
