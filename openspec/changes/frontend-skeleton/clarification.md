# Clarification

## 檢查範圍

關卡模式：`system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`、`proposal.md`。`specs`、`design.md`、`tasks.md` 尚未產生，只能由它們檢查的項目標「後續產物」。

對照基準：`openspec/config.yaml` 的 `context`、`AGENTS.md`、`docs/development/architecture.mdx`（§前端、§待決、§決策紀錄）、ADR-002／ADR-003／ADR-005／ADR-007、`docs/development/rules/` 的 api／frontend／testing 三份、規格 07-01、`design/system/brand.md`，以及維護者 2026-11-20 核可的畫面 artifact（`/dev/health` 四種狀態、`/dev/gallery`）。

上游留下的待決共 37 條：SA-1–SA-16、N1–N8、UI-1–UI-7、C1–C6。重疊的合併成下面 19 個 Q；明確缺陷列為 P。

## 檢查結論

19 個 Q 已於 2026-11-20 由維護者全部決議，P1 已派回修；下表是決議前的檢查結論。

| 面向             | 結論                                                                                                                                                                                                | 問題數 |
| :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 規格完整性       | 待釐清：#505 的工作項與 artifact 的兩頁、四種狀態、七個區塊都有對應的 capability；兩頁的範圍與部分畫面細節要 Q 決定（Q1、Q3、Q14、Q18）。specs、tasks 的涵蓋屬後續產物                              | 4      |
| API Contract     | 待釐清：唯一的端點 `getHealth` 已對齊 `backend/openapi.json`，operationId 沿用後端；成功時的 meta、錯誤外層判定、替身與真實後端的差異要決定（Q2、Q19 的 C1–C5）                                     | 2      |
| 邏輯一致性       | 問題：system-analysis 的六條需求矛盾中，矛盾 2、3、4、6 轉成 Q2、Q8、Q11、Q9；矛盾 5（ADR 編號）是明確缺陷，列 P1；矛盾 1 轉成 Q1                                                                   | 5      |
| 可行性           | 待釐清：技術棧符合 architecture.mdx §前端 與 ADR-005；`tokens.css` 的引入方式會改到所有圓角與字型（Q15）；N3（回傳型別能否穿過 Orval 產物）是技術風險，apply 第一組先驗證，失敗時回到 clarification | 2      |
| 邊界情況         | 待釐清：四種狀態以外的回應（Q3）、重試與逾時（Q4）、背景重新取資料（Q19 的 UI-7）；健康檢查頁的空狀態與無權限依 ui-design 標不適用，理由成立                                                        | 3      |
| 跨功能影響       | 待釐清：獨立專案或工作區（Q7）、Prettier 與 lint-staged 的根目錄設定（Q8）；交給 #506 的兩件事寫在「交給後續產出」                                                                                  | 2      |
| 可測試性         | 待釐清：完整性測試的宣告來源（Q9）、覆蓋率基準（Q12）；測試層名詞正確（Vitest 是 unit／component，E2E 專指 Playwright 且屬 #506）。Scenario 名稱的對應屬後續產物                                    | 2      |
| 規格範圍         | 通過：沒有要求改 `docs/specs/`、`00-prd.mdx` 或 `design/prototype/`；會讓畫面偏離 artifact 的選項都已在題目中標出「要維護者再看過」。tasks 的範圍屬後續產物                                         | 0      |
| 任務設定驅動     | 通過：本次沒有任何任務、資料集或 output type 的邏輯。延續約束：元件展示頁之後列出標記 widget 時，依設定（output type）出現，不寫死某一種任務                                                        | 0      |
| 測試集答案不外露 | 通過：兩頁都不碰任務與答案，標記員到不了開發用頁面；唯一的端點只回服務與資料庫狀態。延續約束：展示頁之後的 widget 樣本資料不得含標準答案或測試集辨識資訊                                            | 0      |

## 決議（Q）

### Q1. 兩頁進不進正式建置

- **來源**：system-analysis 待決 SA-1、需求矛盾 1；system-design §技術待決 1；ui-design SA-1
- **問題**：artifact 假設兩頁只在開發環境出現，但 #506 的驗收要在容器裡看到健康檢查頁顯示成功。
- **決議**：兩頁只在 Vite 開發模式註冊路由，正式建置剪除。#506 在容器裡改以後端 `/api/v1/health` 驗證，或把 E2E 跑在開發伺服器上。
- **理由**：開發用頁面的讀者是開發者，不該進正式 bundle；#506 的驗收換驗證對象即可，不必為它開放正式路由。
- **已回修**：system-analysis（SA-1、矛盾 1）、system-design、ui-design、proposal
- **日期**：2026-11-20（維護者）

### Q2. 成功時交不交出 `traceId` 與伺服器時間（含 C6）

- **來源**：SA-2、需求矛盾 2；system-design 待決 2；api-contract C6
- **問題**：唯一出口拆掉外層後只剩 `data`，但核可畫面的〔正常〕顯示 traceId 與檢查時間。錯誤型別要不要也帶 `timestamp`，與此一起決定。
- **決議**：`apiFetch` 回傳 `{data, meta:{traceId, timestamp}}`；`ApiError` 也帶 `timestamp`。
- **理由**：核可畫面的〔正常〕要顯示 traceId 與檢查時間，拆外層時不能把它們丟掉；錯誤與成功同形，呼叫端好處理。
- **已回修**：system-analysis（SA-2、矛盾 2）、system-design、api-contract（C6）、ui-design
- **日期**：2026-11-20（維護者）

### Q3. 四種狀態以外的回應歸哪裡（含 C5）

- **來源**：SA-3；ui-design SA-3；api-contract C5
- **問題**：`500`、`404`、`405`、`406`、沒有外層的內容要顯示成什麼；連不到後端時「錯誤類型」原樣顯示 `timeout` 還是一律 `network`。
- **決議**：所有錯誤外層都走〔503〕的錯誤版面，標題用通用的「後端回報錯誤」，再列錯誤碼與訊息；不是外層的回應歸〔連不到後端〕，「錯誤類型」列直接顯示 `network` 或 `timeout`。
- **理由**：四種狀態不變、畫面不偏離 artifact，又涵蓋 404／422／500 等其餘回應。
- **已回修**：system-analysis（SA-3）、api-contract（C5）、ui-design
- **日期**：2026-11-20（維護者）

### Q4. 重試、逾時與「認證錯誤」的範圍

- **來源**：SA-4、SA-5；system-design 待決 4、5、§快取、生命週期與效能
- **問題**：重試次數與請求逾時要一起定，否則「資料庫無法連線」可能被逾時誤判成「連不到後端」；`isAuthError` 含不含 `403`。
- **決議**：不自動重試；請求逾時 15 秒；`isAuthError` 只認 401。
- **理由**：後端健康檢查最長 10 秒，15 秒才不會把資料庫無法連線誤判成連不到後端；頁面有「重新檢查」按鈕，自動重試只會拉長等待；403 是無權限不是未登入，留給 01-01。
- **已回修**：system-analysis（SA-4、SA-5）、system-design
- **日期**：2026-11-20（維護者）

### Q5. 語系層與送出的語言

- **來源**：SA-6；system-design 待決 6；ui-design SA-6
- **問題**：本次要不要建語系層，`Accept-Language` 送什麼。
- **決議**：本次就建 react-i18next 語系層，介面文字有繁中（zh-TW）與英文（en）兩份；語言依 `navigator.language` 判斷，`zh` 開頭用 zh-TW，其餘用 en；畫面不加切換控制項；`Accept-Language` 與介面語言一致。
- **理由**：維護者選擇語系層一開始就到位；不加切換器讓版面維持 artifact 的樣子，切換器留給之後的業務版面。測試以指定語言執行。
- **已回修**：system-analysis（SA-6，新增語系 capability）、system-design、ui-design、proposal（Capabilities 加一項）
- **日期**：2026-11-20（維護者）

### Q6. 網路替身用在哪

- **來源**：SA-7；system-design 待決 7；ui-design SA-7
- **問題**：MSW 只用在測試，還是開發時也能在瀏覽器切換（後者畫面要加標示）。
- **決議**：MSW、faker 與 Orval 產生的 `*.msw.ts` 只給測試用；lint 擋住產品碼 import，正式 bundle 不含。
- **理由**：替身只為測試存在，畫面維持 artifact；開發時要看錯誤狀態就關掉後端或資料庫。
- **已回修**：system-analysis（SA-7）、system-design
- **日期**：2026-11-20（維護者）

### Q7. 獨立專案或根目錄工作區

- **來源**：SA-8；system-design 待決 8
- **問題**：`frontend/` 是獨立的 pnpm 專案，還是加 `pnpm-workspace.yaml` 併入根目錄。
- **決議**：用根目錄 pnpm workspace：新增 `pnpm-workspace.yaml`，`frontend/` 是 workspace 套件，共用一份 `pnpm-lock.yaml` 與根目錄的 Prettier。
- **理由**：一份 lockfile、一個 Prettier 版本、`pnpm install` 一次裝好，`scripts/setup.sh` 不用多一步；ADR-002 選的 pnpm 本來就支援 workspace。
- **已回修**：system-analysis（SA-8）、system-design、proposal
- **日期**：2026-11-20（維護者）

### Q8. 契約管線：產物格式化、手寫 `.ts` 的格式化、一條命令的範圍

- **來源**：SA-9、需求矛盾 3、SA-10；system-design 待決 9、10、N7
- **問題**：Prettier pre-commit 會改寫 Orval 產物；lint-staged 不格式化 `ts`／`tsx` 但 CI 會擋；`api:generate` 包不包含後端匯出。
- **決議**：`frontend/src/api/generated/` 進 `.prettierignore`；lint-staged 加上 `ts,tsx`；`pnpm api:generate` 只讀 `backend/openapi.json` 跑 Orval，匯出到產生的整條鏈由 #506 的根目錄指令串起。
- **理由**：產物維持 Orval 原樣，漂移檢查才準；手寫 ts 在 commit 時就格式化，CI 的 `prettier --check` 不會意外擋下；前端指令不依賴 Python。
- **已回修**：system-analysis（SA-9、SA-10）、system-design（N7）、proposal
- **日期**：2026-11-20（維護者）

### Q9. 能不能改 shadcn 原語的原始碼、對照層怎麼補語意變數（含 N1）

- **來源**：SA-11、需求矛盾 6；system-design 待決 11、N1；ui-design §shadcn 沒有對應語意的 token
- **問題**：artifact 的 `cta`、Badge 五種、Alert 四種都要改 `components/ui/`，而 architecture.mdx 寫「shadcn 元件不改寫」；完整性測試的宣告來源是型別推導還是執行期陣列。
- **決議**：允許修改 `components/ui/` 的 shadcn 原語加 variant；對照層新增 `--cta`、`--success` 等語意變數，原語只用語意變數；每個原語匯出 `as const` 的 variant 陣列，完整性測試在執行期比對。`architecture.mdx`「shadcn 元件不改寫」那句另開 docs issue 改準。
- **理由**：shadcn 本來就是複製進來的自有碼；語意變數讓原語不綁 tokens.css 命名；執行期陣列讓「宣告→展示」真的被測到。
- **已回修**：system-analysis（SA-11、矛盾 6）、system-design（N1）、ui-design
- **日期**：2026-11-20（維護者）

### Q10. Button 的 `link` variant

- **來源**：system-design N5
- **問題**：artifact 只列六種 variant，shadcn 預設宣告七種（多 `link`）。
- **決議**：刪掉 Button 的 `link` variant，只宣告 artifact 的六種。
- **理由**：與核可畫面一致；artifact 裡的 link 只是說明測試怎麼擋。之後需要時再加，展示頁一起補。
- **已回修**：system-design（N5）、ui-design
- **日期**：2026-11-20（維護者）

### Q11. 開發用頁面顯示內部資料

- **來源**：SA-12、需求矛盾 4；ui-design SA-12
- **問題**：錯誤碼、traceId、`VITE_API_BASE_URL` 出現在畫面上，算不算 07-01「不出現系統內部資料」的例外；要不要同時做業務頁共用的錯誤元件。
- **決議**：兩個開發用頁面是 07-01「不出現系統內部資料」的例外，照 artifact 顯示錯誤碼、traceId 與設定名；本次不做業務頁共用的錯誤元件，留到 01-01 依 07-01 設計。
- **理由**：兩頁只在開發模式（Q1），讀者是開發者；沒有業務畫面可對照，現在做共用元件只會猜。
- **已回修**：system-analysis（SA-12、矛盾 4）、ui-design
- **日期**：2026-11-20（維護者）

### Q12. 覆蓋率基準

- **來源**：SA-13；system-design 待決 13
- **問題**：本次產不產覆蓋率報告、記不記第一次基準。
- **決議**：`vitest --coverage` 產報告，分母排除 `src/api/generated/`，數字記進 acceptance.md 當第一次基準；不設門檻、不擋 CI。
- **理由**：與 #504 後端一致；骨架階段的數字容易失真，門檻由 #506 或之後決定。
- **已回修**：system-analysis（SA-13）、system-design
- **日期**：2026-11-20（維護者）

### Q13. 深色範圍

- **來源**：SA-14；system-design 待決 14；ui-design SA-14
- **問題**：對照層含不含深色、展示頁要不要切換開關。
- **決議**：對照層同時對應深色（`html[data-theme="dark"]`）；元件展示頁標題列右側加「淺色／深色」切換，只改 `<html data-theme>`，預設淺色、不記住選擇；健康檢查頁不加。畫面已由維護者在 artifact 第 4 版（2026-11-20）確認。
- **理由**：展示頁是檢查元件的地方，兩種主題都要看得到；不記住選擇，重新整理就回到與 tokens.css 預設一致的淺色。
- **已回修**：system-analysis（SA-14）、system-design、ui-design、proposal
- **日期**：2026-11-20（維護者）

### Q14. 根路徑與找不到頁面

- **來源**：SA-15；system-design 待決 15
- **問題**：`/` 與不存在的路徑顯示什麼；artifact 沒有畫。
- **決議**：開發模式下 `/` 與未知路徑都導向 `/dev/health`；正式建置只有空殼，首頁與找不到頁面由 01-01 一起設計。
- **理由**：不新增 artifact 沒有的畫面。
- **已回修**：system-analysis（SA-15）、ui-design
- **日期**：2026-11-20（維護者）

### Q15. `tokens.css` 的引入方式（含 UI-1）

- **來源**：system-design N2；ui-design UI-1
- **問題**：整份引入會帶進外部字型、元素樣式（標題襯線）與圓角變數，蓋過 Tailwind 的同名變數。
- **決議**：以一支小 Vite 外掛在建置時只抽出 `tokens.css` 中 `:root` 與 `html[data-theme="dark"]` 的自訂屬性，產物不提交；不載入外部字型、不套用元素規則。圓角與字型仍以 tokens.css 的值為準。
- **理由**：整份引入會帶進 Google Fonts 外部連線與襯線標題，並覆蓋 Tailwind 同名變數；只抽變數讓畫面與 artifact 一致。代價是多一支外掛要測。
- **已回修**：system-design（N2）、ui-design（UI-1）
- **日期**：2026-11-20（維護者）

### Q16. Token 對照區塊的資料來源

- **來源**：system-design N8
- **問題**：對照的唯一來源是 `styles/theme.css`，但 F1 不讓 `pages/` import `styles/`。
- **決議**：展示頁的 Token 對照以 Vite `?raw` 讀 `styles/theme.css` 解析變數清單；lint 規則對這一個檔案具名放行並註明理由。
- **理由**：對照表永遠與檔案一致；例外只開一個具名的口，其他頁仍受 F1 約束。
- **已回修**：system-design（N8）、ui-design
- **日期**：2026-11-20（維護者）

### Q17. artifact 對不到刻度或 token 的值

- **來源**：ui-design UI-2
- **問題**：間距 6／10／12／14／20px、字級 13／15px、停用底色、骨架與虛線框顏色、測試示意的淺紅色。
- **決議**：間距與字級取最近的刻度，顏色用語意最接近的既有 token；不寫死值、不加新 token；差異列進 ui-design 的對照表。
- **理由**：畫面差 1–2px 可以接受，換來不寫死值、不擴充 token。
- **已回修**：ui-design（UI-2）
- **日期**：2026-11-20（維護者）

### Q18. 「檢查時間」的格式

- **來源**：ui-design UI-3
- **問題**：artifact 帶秒與「（UTC+8）」，`brand.md`（維護者 2026-11-18 裁定）規定 `YYYY-MM-DD HH:mm`。
- **決議**：開發頁的檢查時間照 artifact 顯示 `YYYY-MM-DD HH:mm:ss（UTC+8）`，以開發頁例外記錄；業務頁仍依 `brand.md` 的 `YYYY-MM-DD HH:mm`。
- **理由**：一分鐘內連按兩次「重新檢查」要分得出來。
- **已回修**：ui-design（UI-3）
- **日期**：2026-11-20（維護者）

### Q19. 細節與技術預設（一次收下或逐條改）

- **來源**：ui-design UI-4、UI-5、UI-6、UI-7；system-design N4、N6；api-contract C1、C2、C3、C4
- **問題**：下列各條都有上游建議值，不影響範圍：
  - UI-4：展示板文字與「完整性測試示意」不上頁面
  - UI-5：空狀態圖示用 Lucide `Inbox`
  - UI-6：健康檢查卡片沿用 artifact 的寬度；767px 以下目錄移到上方（`brand.md` 斷點）；目錄依網址 hash 高亮
  - UI-7：只有首次載入與按「重新檢查」顯示載入中，背景更新直接換結果
  - N4：不開 `exactOptionalPropertyTypes`，其他嚴格旗標照開
  - N6：自寫合成 signal 的小函式；jsdom 與目標瀏覽器都支援 `AbortSignal.any` 時改用標準 API
  - C1：前端測試一律以固定 fixture 覆寫產生的 handler
  - C2：fixture 照後端契約帶 `X-Correlation-ID` 與 `Content-Language`
  - C3：`503` 的錯誤外層手組 fixture，型別取自產物
  - C4：`errors` 缺鍵時視同 `null`，其餘照 `required`
- **決議**：十條全部照建議：UI-4、UI-5、UI-6、UI-7、N4、N6、C1、C2、C3、C4 依題目所列。
- **理由**：都不影響範圍，上游建議值合理。
- **已回修**：ui-design、system-design、api-contract
- **日期**：2026-11-20（維護者）

## 已修正（P）

| 編號 | 位置                                                                        | 問題                                                                    | 修正                                                                                                                                   |
| :--- | :-------------------------------------------------------------------------- | :---------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| P1   | `openspec/config.yaml` `rules.ui-design`；system-analysis 需求矛盾 5、SA-16 | 前端架構的 ADR 引用寫成 ADR-004（認證與安全），應為 ADR-005（前端架構） | 本 change 本來就要改 `config.yaml`，在 apply 時改成 ADR-005；system-analysis 的 SA-16 改標「已由 clarification P1 處理」（2026-11-20） |

## 交給後續產出

- 所有 Q 的決議依上面各節；specs、design、tasks 不得重新討論。
- N3 是技術風險：apply 第一組先以實際的 Orval 版本確認 `EnvelopeData<T>`（或 Q2 決定的回傳形狀）能穿過產物；確認失敗是故障，停下來回到 clarification。
- 交給 #506（寫在 design.md 的跨 change 依賴，不在本 change 實作）：前端 Docker build context 必須包含 `design/prototype/assets/`；`.env.example` 要有 `CORS_ALLOWED_ORIGINS=http://localhost:5173` 與 `VITE_API_BASE_URL=http://localhost:8000`。
- 每條 requirement 追溯到 ADR 與規則文件的條號（`config.yaml` 的 `context`，#503），畫面相關的另註明 artifact 的區塊。
- 會讓畫面偏離已核可 artifact 的實作細節，一律回到維護者，不在 apply 中自行調整。
- 畫面以 artifact 第 4 版為準（Q13 在元件展示頁加「淺色／深色」切換，維護者 2026-11-20 確認）。
- Q5 新增語系 capability：兩頁的介面文字都走翻譯鍵，不寫死中文字串；測試以指定語言執行。
- Q9 需要另開一張 `[Docs]` issue 改準 `architecture.mdx`「shadcn 元件不改寫」那句，不在本 change 改。
