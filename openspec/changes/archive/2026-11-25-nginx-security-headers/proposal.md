# Proposal

## Why

ADR-008 D1 與 `architecture.mdx` §容器視圖 要求 Nginx 當唯一公開入口並負責安全標頭；#506 已交付這個入口（`frontend/nginx.conf`，兩層共用），也已帶上 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Cross-Origin-Opener-Policy`、`Permissions-Policy` 五個標頭與 `server_tokens off`，但**沒有 CSP、沒有任何 HSTS 的決定，而且這組標頭沒有任何 requirement 或自動檢查**：有人刪掉一行或在某個 `location` 自己加標頭，整組標頭會靜靜消失，CI 不會失敗（system-analysis §#506 已經交付的 vs. #568 還缺的；system-design §實測基線）。`backend-modules.mdx` §已知限制「Nginx 與安全標頭」列也還掛著 #568。本 change 補上 CSP、定下防嵌入與 HSTS 的做法、把整組標頭變成可測契約，並讓 CI 在動到公開入口時驗證它們（issue #568 §需求目標、§驗收條件 2–4）。

issue #568 §使用情境 寫「repo 裡還沒有 Nginx 設定，#506 的範圍也不含」，與現況不符（system-analysis §需求矛盾 1）。本 proposal 以現況為準，把 #568 視為「補齊與驗證既有設定」而不是新建；issue 本文不改寫，由主 session 在 #568 留言說明 #506 已交付的部分與驗收條件 1 的既有證據（clarification Q8／Q10，維護者 2026-11-25 裁定）。

## What Changes

以下內容依 clarification 的決議（維護者 2026-11-25 逐題裁定）。

- **補上 CSP**（clarification Q2）：公開入口的每一個回應帶強制模式的 CSP，不收違規回報。以同源為主：`default-src 'self'`、`style-src 'self' 'unsafe-inline'`、`img-src 'self' data: blob:`、`object-src 'none'`、`base-uri 'self'`、`form-action 'self'`，其餘指令依 system-design §待決 2 的指令表取 `'self'`；`connect-src 'self'`，並寫明它與建置參數 `VITE_API_BASE_URL` 的耦合（改成跨源呼叫 API 時兩處要一起改）。`style-src` 與 `img-src` 預先放寬，日後彈窗類元件執行時插入的樣式與頭像預覽不會被擋；程式仍不能內嵌（`script-src` 不放寬）
- **防嵌入改為允許同源**（clarification Q3）：`X-Frame-Options` 由 `DENY` 改為 `SAMEORIGIN`，CSP 加 `frame-ancestors 'self'`，兩者並存且一致；嵌入框架來源 `frame-src 'self'`。這讓規格 04-02 的 PDF 說明檔日後能以同源 iframe 顯示，別的網站仍嵌不進來（ui-design §給後續畫面的設計約束）
- **HSTS 不由 Nginx 發**（clarification Q1）：HSTS 是公開入口前面 TLS 邊緣的責任；回應**不帶** `Strict-Transport-Security`，並由驗證腳本斷言，把決定固定下來
- **把整組標頭變成可測契約**（clarification Q3-附）：經公開入口的每一類回應（頁面殼、SPA 深層路徑、建置資源、後端成功、後端錯誤回應、Nginx 自產錯誤含 405 與後端停掉後的 502）都帶同一組標頭，值完全相符；標頭不因角色或是否登入而不同。#506 多加的 `Cross-Origin-Opener-Policy`、`Permissions-Policy` 與 `server_tokens off`（`Server` 不帶版本）一併列入契約
- **標頭的自動驗證**（驗收條件 2、3；clarification Q4）：兩種檢查都做，都放在 CI 的 `compose` job，不列必過、不改 `main` ruleset。一是驗證腳本，以 HTTP 客戶端比對上述各類回應的完整標頭值（含不帶 HSTS），Lite 與正式層都跑；二是瀏覽器檢查，對準容器公開入口確認 CSP 不擋前端自己的資源（只跑正式層，system-design D6）。驗證本身的檔案都加進觸發 `compose` 的路徑清單，否則只改驗證的 PR 不會被執行（clarification P3、system-design N2）
- **「首頁正常」的判準**（驗收條件 3；clarification Q5）：頁面殼與建置資源回 200、CSP 違規 0 次、請求失敗 0 次、同源 API 呼叫成功。不依賴頁面內容，日後有頁面也適用
- **驗收條件 1 不另做**：「正式層起得來、後端與資料庫不對外開 port」已由 #506 交付，並已由 CI 的編排結構斷言與正式層 `up --wait` 檢查；本 change 只在 acceptance 引用既有證據（system-analysis §範圍；clarification Q8／Q10）
- **文件**：`docs/development/architecture.mdx` §部署與維運 寫明標頭的實際檢查方式（驗收條件 4）、HSTS 由 TLS 邊緣負責、開發伺服器不經 Nginx 所以不帶 CSP（system-design N3）、邊緣代理可能改寫標頭與部署後的手動自查方式（system-design N4）。`docs/diagrams/architecture/backend-modules.mdx` §已知限制「Nginx 與安全標頭」列在實作組刪除。兩者都在實作階段做，不在規劃階段（clarification §交給後續產出）
- **沒有破壞性變更**：不改任何 API 端點、回應欄位、錯誤碼或授權（api-contract）；編排的服務、發布埠與部署者操作都不變（clarification Q1、Q6／Q7）。行為上唯一的放寬是防嵌入由 `DENY` 改為 `SAMEORIGIN`，只多允許同源嵌入，不影響任何既有功能

### 這次不做

- 後端信任反向代理的來源 IP、`X-Forwarded-*` 的信任邊界，以及 `location /api/v1/` 的轉發標頭：本 change 不碰，全留給 #566（clarification Q6／Q7）
- 全域速率限制（ADR-004 D7）：要先有正確的來源 IP（#566），不在本 change（clarification Q8／Q10）
- Cloudflare 的設定、origin TLS 模式、HSTS 的實際發送（ADR-008 §待決 第 1 列；clarification Q1）
- 後端自己發安全標頭（clarification Q6／Q7：後端不發）
- 正式層的資料庫備份（ADR-008 D9）
- 任何畫面、`design/prototype/`、`docs/specs/`、`docs/specs/00-prd.mdx`（ui-design：本次無 UI 變更；clarification Q9：不補回 `docs/specs/`）
- 修改 `main` ruleset（#506 clarification Q3、Q10；本 change clarification Q4 維持 `compose` 不列必過）
- 不存在的建置資源退回頁面殼回 200（system-design N1）：與安全標頭無直接關係，寫進本 change PR 的非阻擋事項（clarification N1）

## Capabilities

### New Capabilities

- `security-headers`：系統對外回應帶哪些安全標頭、值是什麼、在哪些回應類別上必須出現，以及這組標頭不得擋下前端自己的資源。涵蓋 Q2 的 CSP、Q3 的防嵌入（`X-Frame-Options` 與 `frame-ancestors` 並存且一致、`frame-src 'self'`）、Q3-附 的三項附加標頭、Q1 的「回應不帶 HSTS」、每一類回應都帶同一組且值完全相符、與角色或登入狀態無關，以及 Q5 的「首頁正常」判準。`container-runtime` 管的是編排起哪些服務、誰發布埠、轉發哪些路徑；回應標頭是另一個會隨日後頁面與資源來源持續演進的行為（ui-design §給後續畫面的設計約束 列出的 PDF 嵌入、頭像預覽、外部字型、彈窗元件都會回到這裡調整），所以獨立成 capability

### Modified Capabilities

- `ci-quality-gates`：Requirement「容器編排在相關變更時驗證」的觸發路徑加入驗證腳本與瀏覽器檢查的檔案（clarification P3、system-design N2）；Requirement「容器編排驗證的步驟與失敗條件」加兩步：經公開入口比對安全標頭（缺少、值不符、出現重複值或帶 HSTS 時失敗），以及正式層的瀏覽器檢查（未達 Q5 判準時失敗）。Requirement「e2e 每張 PR 執行」不改：瀏覽器檢查放在 `compose` job，不進 `e2e` job（clarification Q4）
- `e2e-testing`：要寫 delta。Q4 裁定的「腳本加瀏覽器檢查」對應 system-design §待決 4 的選項 (c)，其中瀏覽器檢查就是選項 (b) 的「一條對準容器入口的 e2e」：用的是 `e2e/` 套件的瀏覽器與設定，不是另起一套工具。既有 requirement 都假設 e2e 自己起開發伺服器，因此要改：
  - Requirement「位址設定只集中在一處」：多一種對準既有容器公開入口、不自起伺服器的跑法，位址仍只由同一個設定檔決定
  - Requirement「e2e 是根目錄的獨立套件」的 Scenario「從根目錄執行 e2e」：`e2e` job 以開發伺服器跑全部旅程時，只在容器入口才成立的旅程不得被執行或造成失敗
  - 新增「公開入口不擋前端自己的資源」旅程的 requirement，判準依 Q5；spec 檔路徑依「e2e 是根目錄的獨立套件」的 `e2e/<module>/<page>.spec.ts` 規則，在 spec delta 定（system-design §待決 4 舉例 `e2e/public-entry/shell.spec.ts`）

不寫 delta 的既有 capability：

- `container-runtime`：不改。Q6／Q7 維持現況（入口在前端映像內、兩層共用同一份 `nginx.conf`、後端不發安全標頭），Q1 不在公開入口終止 TLS，所以服務組成、發布埠、轉發路徑與設定範例檔都不變；Requirement「前端服務是唯一公開入口」已涵蓋驗收條件 1。標頭本身的行為寫在 `security-headers`，不回頭塞進這個 capability。Q4 的驗證雖放在 `compose` job，但那是 CI 的步驟，屬 `ci-quality-gates`，不改變容器的執行行為
- 前端與後端的 capability：Q2 不用 nonce、不收違規回報，前端程式與後端都不改，api-contract 不需重寫

## 需求來源

本 change 是基礎建設 change，`docs/specs/` 沒有規格涵蓋公開入口的回應標頭，`docs/specs/00-prd.mdx` 也沒有相關條文；依 `spec-migration.mdx` D4 與 `openspec/config.yaml` context（維護者 2026-11-20 裁定，#503），requirement 追溯到 issue、ADR、規則文件的條號與本 change clarification 的 Q 編號（system-analysis §需求依據）。clarification Q9 決定不補回 `docs/specs/`。

| 來源                                                    | 章節／編號                                                   | 用在哪裡                                                                           |
| :------------------------------------------------------ | :----------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| issue #568                                              | §使用情境／功能範圍、§需求目標、§驗收條件 1–4                | 全部範圍                                                                           |
| ADR-008                                                 | D1 §決定、§後果；D2 §決定；§待決 第 1 列                     | Nginx 是唯一公開入口並負責安全標頭；HSTS 歸 TLS 邊緣（Q1）                         |
| `docs/development/architecture.mdx`                     | §容器視圖 表「Nginx」列；§部署與維運                         | 標頭的歸屬；驗收條件 4 的寫回位置                                                  |
| ADR-004                                                 | D7 §決定、§什麼情況要重新討論 第 2 點                        | 全域速率限制不在範圍（Q8／Q10）                                                    |
| security-agent-rules                                    | S2 §正例、S9 §正例                                           | CSP 是 S9 輸出轉義之外的第二道防線；規則文件沒有任何條文規範回應標頭或 CSP         |
| `AGENTS.md`                                             | Hard Rule 9                                                  | XSS 無處落地的補強                                                                 |
| `docs/diagrams/architecture/backend-modules.mdx`        | §已知限制「Nginx 與安全標頭」列                              | 本 change 落地後刪除                                                               |
| archive `2026-11-23-infra-compose-e2e-ci`               | clarification Q2、Q3、Q10；system-design D6、D7；tasks 6.2   | 入口在前端映像內、兩層共用；`compose` 與 `e2e` 不列必過；既有五個標頭的來源        |
| 本 change `clarification.md`                            | Q1–Q10、Q3-附、N1、P3（維護者 2026-11-25 裁定）              | 各項標頭的值、驗證位置與判準、範圍分界                                             |
| 規格 04-02（`02-annotation-workspace.mdx`）、規格 01-01 | §規格 說明檔案預覽「PDF」列；§業務流程「用 Google 帳號登入」 | 前瞻性限制，不是本 change 的需求依據；Q3 允許同源嵌入即為 04-02 PDF 預覽保留的前提 |

## 決議

clarification 的待決項目已由維護者 2026-11-25 在停點逐題裁定（system-analysis 待決 1–10、system-design N1–N4 對應如下）。

| 編號    | 題目                                 | 決議                                                                                                                                                     | 落在本 proposal 的位置                                             |
| :------ | :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| Q1      | HSTS                                 | Nginx 不發，交給前面的 TLS 邊緣；驗證腳本斷言回應不帶 `Strict-Transport-Security`                                                                        | What Changes「HSTS」；`security-headers`；不改 `container-runtime` |
| Q2      | CSP 政策                             | 強制模式、不收違規回報；同源為主，`style-src` 加 `'unsafe-inline'`、`img-src` 加 `data: blob:`；`connect-src 'self'` 並寫明與 `VITE_API_BASE_URL` 的耦合 | What Changes「補上 CSP」；`security-headers`                       |
| Q3      | 防嵌入                               | 允許同源：`X-Frame-Options: SAMEORIGIN` 與 `frame-ancestors 'self'` 並存且一致；`frame-src 'self'`                                                       | What Changes「防嵌入」；`security-headers`                         |
| Q3-附   | #506 多加的三項是否列入契約          | 列入：`Cross-Origin-Opener-Policy`、`Permissions-Policy`、`server_tokens off`                                                                            | What Changes「可測契約」；`security-headers`                       |
| Q4      | 驗證位置                             | 腳本加瀏覽器檢查，都放 CI `compose` job，不列必過；腳本比對六類回應的完整標頭值                                                                          | `ci-quality-gates`、`e2e-testing` 要寫 delta                       |
| Q5      | 「首頁正常」的判準                   | 頁面殼與建置資源回 200、CSP 違規 0 次、請求失敗 0 次、同源 API 呼叫成功                                                                                  | `security-headers`、`e2e-testing` 的旅程                           |
| Q6／Q7  | 標頭歸屬與 #566 的分界               | 維持現況：前端映像內的 Nginx、兩層都生效、後端不發安全標頭；不碰轉發標頭與代理信任                                                                       | 不改 `container-runtime`；「這次不做」                             |
| Q8／Q10 | 全域限流與 issue 本文                | 限流不做；主 session 在 #568 留言說明 #506 已交付的部分與驗收條件 1 的既有證據，不改寫本文                                                               | Why；「這次不做」；驗收條件 1 引用既有證據                         |
| Q9      | 是否補回 `docs/specs/`               | 不補                                                                                                                                                     | 需求來源                                                           |
| N1      | `/assets/missing.js` 回 200          | 不在本 change，寫進 PR 的非阻擋事項                                                                                                                      | 「這次不做」                                                       |
| N2／P3  | 驗證檔案不在觸發路徑                 | tasks 把驗證檔案加進 `compose` 的觸發清單                                                                                                                | `ci-quality-gates`                                                 |
| N3、N4  | 開發伺服器不帶 CSP；邊緣代理改寫標頭 | 寫進 `architecture.mdx` §部署與維運（clarification §交給後續產出）                                                                                       | What Changes「文件」                                               |

本 proposal 沒有剩下的待決問題。

Hard Rule 5（任務設定驅動）與 Hard Rule 6（測試集答案不外露）：clarification 第 9、10 面向皆為通過。本 change 只動 Nginx 設定、驗證腳本與 CI，不碰任務設定；標頭對所有角色一致、不帶任何資料，CSP 是 XSS 的第二道防線，補強而不取代後端的答案隔離與 S9（system-design §權限檢查點）。

## Impact

- **設定檔**：`frontend/nginx.conf` 的 server 層級標頭加 CSP、`X-Frame-Options` 改為 `SAMEORIGIN`，維持「server 層級、一律 `always`、`location` 不得自己加標頭」的不變式（system-design D1）。兩層共用同一份設定，改動同時在 Lite 與正式層生效
- **CI**：新增標頭驗證腳本；`.github/workflows/ci.yml` 的 `compose` job 多標頭檢查（兩層）與瀏覽器檢查（正式層）兩步，job 多裝 pnpm 依賴與 Chromium（system-design 估計多 1–2 分鐘，`timeout-minutes: 20` 不需調整）；`scripts/ci-changed-paths.mjs` 與其測試加入新的觸發路徑
- **e2e**：`e2e/playwright.config.ts` 多一種對準容器入口、不自起伺服器的跑法；新增一條檢查 CSP 不擋前端資源的旅程
- **文件**：`docs/development/architecture.mdx` §部署與維運；`docs/diagrams/architecture/backend-modules.mdx` §已知限制
- **API、資料模型、畫面、前後端程式**：無（api-contract、system-design §資料模型異動、ui-design）
- **部署者**：不需改任何操作。CSP 為強制模式，日後引入新資源來源（外部圖片或字型、跨源 API、非同源內嵌框架）的前端 change 要同步放寬政策，否則瀏覽器會擋下、畫面沒有錯誤訊息（ui-design §給後續畫面的設計約束）；這類破損在開發伺服器上看不出來，要靠 `compose` 的瀏覽器檢查（system-design N3）。正式環境實際送到瀏覽器的標頭可能被邊緣代理改寫，本 repo 只驗到 origin（system-design N4）
- **相關 issue**：#566 同改 `frontend/nginx.conf`，但本 change 不碰轉發標頭，兩張沒有相依（Q6／Q7）；#565 的全域上限不在本 change（Q8／Q10）
