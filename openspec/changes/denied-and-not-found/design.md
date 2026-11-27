# Design

## Context

動機見 `proposal.md` §Why；決議以 `clarification.md` Q1～Q9 為準。這份只寫 `system-design.md`、`ui-design.md`、`api-contract.md` 沒寫到、實作前要先定的做法，那三份寫過的只引用段落。

現況與限制：

- **後端、API、資料模型都不變**（`system-design.md` §設計結論、`api-contract.md` 開頭）。正式環境沒有任何端點會回 `403 PERMISSION_DENIED` 或授權產生的 `404`，也沒有任何頁面定址到「那一筆」，所以本單範圍內的 9 條 Scenario 在本單都沒有真實觸發點（clarification Q1）
- 前端已有的相關部分：`frontend/src/api/api-error.ts`（`ApiError`、`isAuthError`）、`components/ui/card.tsx`、`components/ui/button.tsx`（有 `asChild`）、元件展示頁 `pages/dev-gallery/`（`gallerySections` 十個區塊、`galleryItem()` 產生的 `data-gallery-item`、`GallerySection` 的 `h2` 外框）、`lib/i18n` 的 `devGallery` namespace（只在開發模式載入）
- 每次提交動到 `frontend/**/*.ts{,x}` 時，`scripts/check-changed.sh` 會對整棵樹跑 `node scripts/check-component-reuse.mjs`；目前這個分支是 `PASS`（允許清單 0 列）
- 常駐文件 `docs/diagrams/architecture/frontend-routes.mdx` 與 `design/system/design-gaps.md`（G-67、G-68）已在規劃階段先改好（`ui-design.md` §常駐文件異動；clarification P2、Q7、Q8）

## Goals / Non-Goals

**Goals:**

- 一個不送請求、不自帶字面與去處的共用畫面，接手單（#763、#773、#725、#740）只要傳入字面、去處與識別碼就能畫出 07-03 的兩種畫面
- 一個只有一套規則的拒絕回應分類，接手單不必各自判斷 `status` 與 `code`
- 本單範圍內 9 條 Scenario 以 unit 與元件展示頁上的 e2e 驗得到

**Non-Goals:**

- 不新增或修改任何產品路由，不做通用找不到頁；未註冊的網址維持導回暫時落點（clarification Q2）
- 不改 `createQueryClient()` 的全域設定（Q9）、不改 `frontend/nginx.conf`、不在畫面做識別碼的格式檢查（Q6）
- 不改 `permission-authorization`；停用成員要顯示哪一種交 #763（Q5）
- 不寫 `design/system/components/` 的元件規格（Q8，等下次 `design-handoff`）

## Decisions

### D1. 共用畫面叫 `BlockedScreen`，放 `frontend/src/components/blocked-screen.tsx`

位置與元件樹照 `ui-design.md` §元件樹 › 共用畫面 `BlockedScreen`（F5：用到它的 prototype 畫面分屬兩個 feature）。同檔另匯出 `BlockedIdentifier`。

- 檔名最後一個字 `screen` 在 `design/system/components/` 沒有同字尾的規格，`check-component-reuse.mjs` 不會判成重造；每次提交仍照常跑一次，`FAIL` 就停下回報，不加允許清單
- 替代方案：放 `features/` 底下某一個模組 → 違反 F5（兩個 feature 都要用）；做成 `components/ui/` 的原語 → 它不是 shadcn/ui 原語，而且會被元件展示頁的完整性測試要求宣告 variant，增加無意義的宣告

### D2. 元件的輸入

`ui-design.md` §元件樹 的「元件的輸入」表定了語意，這裡定成 props：

| prop           | 型別                     | 必填 | 預設   | 說明                                                                                            |
| :------------- | :----------------------- | :--- | :----- | :---------------------------------------------------------------------------------------------- |
| `kind`         | `"notFound" \| "denied"` | 是   | —      | 畫在容器的 `data-kind`，測試以它分辨兩種畫面；兩種外觀相同                                      |
| `title`        | `string`                 | 是   | —      | 呼叫端翻好的標題，不帶識別碼                                                                    |
| `description`  | `React.ReactNode`        | 是   | —      | 呼叫端組好的說明；有識別碼時內含 `<BlockedIdentifier value={id} />`（D4）                       |
| `backTo`       | `string`                 | 是   | —      | 站內路徑，交給 React Router 的 `Link`                                                           |
| `backLabel`    | `string`                 | 是   | —      | 寫出去處的標籤，也是連結的可存取名稱                                                            |
| `headingLevel` | `1 \| 2`                 | 否   | `1`    | 那一頁保留自己的一級頁首時傳 `2`（`ui-design.md` §元件樹；03-03 §共用任務標頭 第 8 條）         |
| `focusOnMount` | `boolean`                | 否   | `true` | 掛上時把焦點移到標題；元件展示頁傳 `false`，工作頁籤切回時由 #725 依 07-02 的鍵盤規則決定（D6） |

`BlockedIdentifier` 只有一個 prop `value: string`。

- **恰一個返回操作**：元件不收 `children`、不收第二個動作或重試的 prop，只用 `backTo` 與 `backLabel` 畫一個連結，型別本身就擋住第二個操作（07-03 §畫面的組成 第 5、6 條）
- **取代內容區**由呼叫端負責：元件是一塊佔滿內容欄寬度的區塊，呼叫端在判定拒絕或找不到時「改畫它、不畫原本的內容」。Scenario「反向：不得用空白內容代替找不到」在 unit 測試以一個測試檔內的示意頁面驗（同一個內容區在兩種狀態間切換），不新增產品頁。這個測試檔同時 import `BlockedScreen` 與 `classifyRejection`，而 `components/` 依 `boundaries/dependencies` 只能 import `lib/`，所以放在 `frontend/src/pages/dev-gallery/blocked-flow.test.tsx`（`pages/` 可以 import `components/`、`api/`、`lib/`）
- 替代方案：元件收 `identifier` 與文案鍵、自己組說明 → 元件就有了自己的文案與 i18n 依賴，違反 07-03 §畫面的組成 第一則註與 Q3；收 `back: { to, label }` 物件 → 與兩個字串等價，平的 props 在呼叫端與測試都比較好讀

### D3. 拒絕回應的分類叫 `classifyRejection`

`ui-design.md` §元件樹 › 拒絕回應的分類 定了規則與位置但沒有命名，這裡定為：

- 在 `frontend/src/api/api-error.ts`、`isAuthError` 旁新增 `export type RejectionKind = "denied" | "notFound" | "other"` 與 `export function classifyRejection(value: unknown): RejectionKind`
- 輸入是 `unknown`，與 `isAuthError` 一致，查詢的 `error` 可以直接丟進來；先以 `isApiError` 收斂，不是 `ApiError` 一律 `"other"`
- 只在 `kind === "http"` 且 `status` 與 `code` 同時吻合時才回 `"denied"`（`403` + `PERMISSION_DENIED`）或 `"notFound"`（`404` + `NOT_FOUND`）；依據是 `api-contract.md` §為什麼要看 `code`，不能只看 status
- 純函式：不送請求、不讀快取、不碰路由，也不決定要不要畫成整頁（clarification Q4；SD-2 的 A）
- 替代方案：只看 status → 會把 `403 CSRF_FAILED` 畫成無權限；在 `apiFetch` 或 `QueryClient` 統一攔截換成整頁 → 違反規格 03-03 §誰進得來 第 1 條（標記員是帶回列表加提示）與 07-03 §不在本頁範圍 第 4 條；放 `lib/` → 它只讀 `ApiError`，與 `isAuthError` 同一類，放 `api/` 不新增跨層 import

### D4. 識別碼以 `<bdi>` 的文字節點輸出，說明以 `Trans` 的具名元件插入

`ui-design.md` §元件樹 的 `BlockedIdentifier` 段落定了「純文字、雙向隔離、任意字元換行、不截斷」，做法：

- `BlockedIdentifier` 畫成 `<bdi data-slot="blocked-identifier">{value}</bdi>`，class 用 `[overflow-wrap:anywhere]`；`value` 只經 React 的文字節點輸出，元件內不得出現 `dangerouslySetInnerHTML`
- 呼叫端的語言檔在說明裡以具名的自閉合標記 `<identifier/>` 標出識別碼的位置，以 `react-i18next` 的 `Trans` 搭配 `components={{ identifier: <BlockedIdentifier value={id} /> }}` 組出說明。識別碼**不**經 `values` 插值：插值只會得到字串，無法包進雙向隔離的元素
- 替代方案：插值成字串再整句輸出 → 含 U+202E 的識別碼會把句子其餘部分翻轉；截斷加 tooltip → 違反 07-03 §資料欄位「原值」
- 驗證：unit 測試以含 `<img src=x onerror=alert(1)>` 與 U+202E 的識別碼斷言 DOM 沒有 `img`、識別碼在 `bdi` 內且文字逐字相同；換行與不出現水平捲軸在 jsdom 量不到，由元件展示頁上的 e2e 量（D8）

### D5. 容器與樣式

容器、間距與 token 照 `ui-design.md` §元件與 design token（Card 為準，Q7）：

- 外層是 `<section aria-labelledby={headingId} data-kind={kind}>`，裡面放 `Card`；Card 的間距以 className 覆寫成 `--space-md`，不改 `components/ui/card.tsx`
- 標題用原生 `h1`／`h2`（依 `headingLevel`），不用 `CardTitle`（它是 `div`，沒有標題語意）；說明用原生 `p`，字色 `text-muted-foreground`、字級 `--text-caption`
- 返回連結用 `<Button asChild variant="default" size="sm"><Link to={backTo}>{backLabel}</Link></Button>`；不加圖示（兩個 prototype 面板都沒有圖示）
- 只用 `theme.css` 的語意 class，不寫色碼，深色模式由 `html[data-theme]` 帶

### D6. 無障礙與到達時移焦點

照 `ui-design.md` §互動與無障礙（Q7：移焦點、不用 `role="alert"`）：

- 標題 `tabIndex={-1}`、`outline-none`，以 `useRef` 加 `useEffect` 在掛上時 `focus()`；`focusOnMount` 為 `false` 時不做。StrictMode 下 effect 重跑會再 `focus()` 一次同一個元素，結果相同，不需要防重入
- 下一個 Tab 自然停在返回連結；連結沿用 Button 的 `focus-visible` 焦點環
- 不設 `role="alert"` 或 `aria-live`，避免與焦點移動重複朗讀

### D7. 文案只在元件展示頁新增

`BlockedScreen` 沒有自己的 namespace（07-03 §畫面的組成 第一則註；Q3）。本單只在 `devGallery` 的 `zh-TW`、`en` 兩份新增：

- `sections.blocked`（「無權限與找不到」／"Denied and not found"）、`count.samples`（「樣本 × {{n}}」／"samples × {{n}}"）
- `blocked.notFound.title`、`blocked.notFound.description`、`blocked.denied.title`、`blocked.denied.description`、`blocked.back`；字面逐字照 `ui-design.md` §文案 的展示頁樣本表，說明裡的 `{識別碼}` 寫成 `<identifier/>`（D4）
- 兩份語言檔的鍵集合由既有的 `lib/i18n/locales.test.ts` 檢查一致；`devGallery` 只在開發模式載入，正式建置不帶這些字

示意識別碼放 `pages/dev-gallery/variant-catalog.ts` 的常數：一般樣本 `demo-task-001`；長識別碼由程式產生、300 個字元、只含英數與連字號、不含空白，兩者都不翻譯、不像真實任務編號、不含「測試集」等字（`ui-design.md` §文案 末段）。

### D8. 元件展示頁的一節是 e2e 的入口

照 `ui-design.md` §元件樹 › 元件展示頁的一節（Q8）：

- `gallerySections` 在 `states` 與 `tokens` 之間加 `blocked`，目錄與區塊順序跟著它走；樣本清單 `blockedSampleValues = ["notFound", "denied", "longIdentifier"] as const`，區塊標頭計數由它算出
- 區塊畫在新檔 `frontend/src/pages/dev-gallery/blocked-section.tsx` 的 `BlockedSection`，`DevGalleryPage` 只多一行 `<BlockedSection />`：`DevGalleryPage` 在 `frontend/eslint.config.js` 的 `NAMED_EXEMPTIONS` 有 180 行的 `max-lines-per-function` 上限，目前已 177 行。檔名字尾用 `-section`，不用 `-panel`、`-state`、`-card`，因為那幾個字尾會被 `check-component-reuse.mjs` 規則 3 對上 `design/system/components/` 的規格
- 樣本的返回連結是 React Router 的 `Link`，展示頁從此需要 Router；既有直接 `render(<DevGalleryPage />)` 的測試（`completeness.test.tsx`、`dev-gallery-page.test.tsx`、`gallery-nav.test.tsx`）改用共用的測試 helper `renderGallery()`，以 `MemoryRouter` 包住；完整性測試的 `DECLARED` 加 `blocked-screen` 的 `kind`
- 每個樣本外包一層帶 `data-gallery-item={galleryItem("blocked-screen", "kind", value)}` 的元素；樣本傳 `headingLevel={2}`、`focusOnMount={false}`、`backTo="/dashboard/dashboard"`
- **為什麼用展示頁當 e2e 的入口**：本單沒有任何產品頁面畫得出這兩種畫面（Q1），而為了測試另開一條產品路由會多出一個使用者看得到、規格沒有的頁面（Q1 的理由）；展示頁只在開發模式存在、不經守門、不送任何後端請求（`component-gallery`「展示樣本不含測試集答案」），既有的 `e2e/system-health/dev-pages.spec.ts` 已在預設模式開它。換行與水平捲軸這類 jsdom 量不到的行為只能在真瀏覽器驗
- e2e 檔放 `e2e/system-health/dev-gallery.spec.ts`，與既有開發頁旅程同一個目錄，符合 `e2e:static` 的 `<module>/<page>.spec.ts` 位置規則
- 真實頁面觸發的端對端驗證（後端真的回 `403`／`404`、頁面依分類換畫面）由 #763、#773 補，`ops` 歸檔時留移交清單（Q1）

### D9. 一併更正 `component-gallery` 目錄錨點數

`openspec/specs/component-gallery` 的「目錄依網址錨點標示目前區塊」仍寫「七個」錨點、「其餘六個連結不帶」，但 sidebar-nav 已把區塊加到十個，實作的目錄也是十個。這次本來就要改這條（多一個錨點），所以在同一個 MODIFIED 更正成十一個（AGENTS.md「Fix a wrong existing implementation directly when this change calls, modifies, or replaces it」），不另開 issue。

### D10. 常駐文件由實作角色依實作校正

`frontend-routes.mdx` 的 §目錄、§單一 HTTP 邊界、§元件展示頁、§已知限制、§決策紀錄 已在規劃階段寫好；實作後由 `[@frontend-developer]` 對照實際的檔名、函式名（`classifyRejection`、`BlockedScreen`、`blocked` 區塊 id）校正（`rules.tasks`：常駐文件由寫那段程式的實作角色校正）。`error-codes.mdx`、`endpoint-authorization.mdx`、`backend-modules.mdx`、資料表字典與 ER 都不動（`system-design.md` §常駐文件異動、`api-contract.md` §常駐文件異動）。NoteCraft 站台建置以 CI 的 `docs-site` job 為準，不在 worktree 跑 `notecraftapp build`（會把 worktree 路徑寫進全機共用的快取）。

## Risks / Trade-offs

- [本單交付時沒有任何真實頁面用到這兩種畫面，正式環境也沒有端點回這兩種拒絕] → 9 條 Scenario 以 unit 與展示頁 e2e 驗；`ops` 歸檔時在 #763、#773 留「以真實頁面觸發的端對端驗證」移交清單，在 #763、#730 留 clarification §移出本次的驗收標準 的兩條
- [「權限被撤銷」對到哪一種回應有規格衝突：後端把停用的成員身分回 `404`，07-03 與 03-03 要顯示無權限] → 本單只照回應分（`403` → 無權限、`404` → 找不到），不選邊；`ops` 在 #763 附上這個不一致，由 #763 在它的 clarification 問維護者（Q5）。若維護者選 `403`，是 #763 的 **BREAKING** 變更，`classifyRejection` 不必改
- [`createQueryClient()` 的 `refetchOnWindowFocus` 仍是開的，權限在背景恢復時畫面會自己換回去，違反 07-03 §無權限的畫面 第 3 條] → 本單不改全域設定；`ops` 在 #763、#773、#725 的移交說明寫明「顯示這兩種畫面的查詢要自己關掉 `refetchOnWindowFocus`」（Q9）
- [展示頁的樣本標題是二級，與展示頁區塊標題同級] → 依 `ui-design.md` §元件樹 的決定；標題層級不跳級，輔助技術讀到的是同級標題而不是巢狀，只影響開發頁
- [`Trans` 的具名自閉合標記若在升級 `react-i18next` 後行為改變] → D4 的 unit 測試直接斷言說明文字與 `bdi` 的位置，行為一變就失敗
- [`check-component-reuse.mjs` 規則日後擴大掃描範圍或加入以 `screen` 結尾的元件規格] → 每次提交都會跑；那時 `FAIL` 就停下回報，由 design-handoff 補 G-68 的元件規格時一起處理

## Migration Plan

- 沒有 migration：後端、資料庫、API、`openapi.json` 與前端生成的 client 都不變（`api-contract.md`）。整合檢查以 `git diff --exit-code <merge-base> -- backend/openapi.json docs/diagrams/architecture/api.openapi.json frontend/src/api/generated` 確認三處與 `main` 相同
- 部署：前端一般建置；`BlockedScreen` 與 `classifyRejection` 在正式建置裡沒有呼叫端，tree-shaking 後可能不在 bundle 裡，這是預期的
- 回滾：還原本單的提交即可，沒有資料或設定要回復；`frontend-routes.mdx` 與 `design-gaps.md` 跟著還原
