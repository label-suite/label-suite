# Proposal

## Why

`architecture.mdx` §部署與維運 規定 Nginx 是唯一公開入口，但後端目前不信任它：容器內的 uvicorn 沿用預設信任清單 `127.0.0.1,::1`，所以經 Nginx 進來的請求，`request.client.host` 一律是 Nginx 容器的位址（`system-design.md` 實測 E1：所有人共用一個來源位址）。登入嘗試限制（規格 01-05 §已確認決議 Q3、ADR-004 D7）將來要以來源 IP 當鍵時，這會讓所有人共用同一份額度；ADR-004 D7 背景表明寫「要先信任代理的來源 IP」，本 change 是它的前置條件。

issue #566 的驗收條件有兩個互相拉扯的要求：經 Nginx 要拿到原始來源，直連後端、自帶 `X-Forwarded-For` 的請求不得被採信。`system-design.md` 的實測顯示這兩件事用 uvicorn 內建機制就能達成，但有幾個靜默失敗的陷阱（私有網段預設值可被偽造、`*` 與 `0.0.0.0/0` 等於信任所有人、寫錯值不報錯），所以「信任範圍怎麼表達與驗證」才是這個 change 的重點。

這是基礎設施 change，`docs/specs/` 沒有對應的業務規格，不涉及使用者可見功能（`ui-design.md`、`api-contract.md` 皆為「無變更」）。需求依據為 issue、ADR 與規則文件條號（spec-migration D4；維護者 2026-11-20 裁定，#503）。

## What Changes

**技術事實**（以 `system-design.md` 的實測為準，更正 `system-analysis.md` 的幾處前提；無論 clarification 怎麼決定都成立）：

- uvicorn 的信任清單預設是 `127.0.0.1,::1`（不是只有 `127.0.0.1`），`--proxy-headers` 預設就是開的，所以 CMD 加不加這個旗標沒有差別（實測 A1、A2）。
- 旗標會蓋掉環境變數（實測 D2），所以映像的 CMD 不得寫 `--forwarded-allow-ips`，否則編排檔傳入的 `FORWARDED_ALLOW_IPS` 會被靜默蓋掉。
- 同一份信任清單同時管 `X-Forwarded-For` 與 `X-Forwarded-Proto`（實測 C3）：「信任 XFF 但不信任 XFP」用 uvicorn 內建機制做不到。Nginx 在 TLS 邊緣之後仍送 `$scheme`（`http`，且會覆寫外部帶的值，實測 E4），所以後端的 `scope["scheme"]` 恆為 `http`，與現況相同，不是更糟。
- Nginx 已經送 `X-Forwarded-For`、`X-Forwarded-Proto`、`X-Real-IP`、`X-Forwarded-Host`（`frontend/nginx.conf:64-68`）；`$proxy_add_x_forwarded_for` 把真實 peer append 在最右側，uvicorn 取最右側不受信任者，所以外部預先放入的鏈不影響結果（實測 E4、E6）。
- 預設信任私有位址區段（`10/8`、`172.16/12`、`192.168/16`）有已證實的偽造漏洞（實測 D12：真實用戶端落在受信任的私有網段時，偽造值被採信）；信任整段 Compose 子網路則讓同網路任何容器都能偽造（實測 E2）。
- `*`、`0.0.0.0/0` 都等於信任所有人；host bit 非零（`127.0.0.1/8`）、拼錯、主機名稱都被靜默忽略，uvicorn 不報錯（實測 D4 至 D11）。
- 現有 `client` fixture 是 httpx 直接接 ASGI，不經 uvicorn 的中介層，無法證明驗收條件；要起真實 uvicorn 子行程。Docker 發布埠的來源位址依平台不同（Docker Desktop 為 `192.168.65.1`，Linux 未測），所以不能斷言「經 Nginx 看到的位址等於某個值」。

**候選工作項**（尚未決定，皆待 `clarification.md` 逐題決定，編號為 `system-analysis.md` 待決問題或 `system-design.md` 技術待決）：

- **信任怎麼設**（待決 1）：建議沿用 uvicorn 內建處理，Dockerfile 不動、CMD 不加旗標，信任清單由環境變數 `FORWARDED_ALLOW_IPS` 提供；替代為後端自寫中介層（約 60 行，且 uvicorn 的中介層仍會跑一次）。
- **受信任位址怎麼表達**（待決 2、10；T1、T2）：候選為兩份編排檔宣告預設網路的子網段並固定 `frontend` 服務位址、後端只信任該單一位址（`system-design.md` 的 A1）；信任整段子網路（A2）；預設私有區段（B，有已證實漏洞）；信任容器名稱（C，uvicorn 不解析名稱，不可行）。兩層編排檔同步；沒有 Nginx 的執行方式（本機 `pnpm run dev`、單獨起容器）維持 uvicorn 預設。常數與是否在正式層釘死見 T1、T2。
- **啟動檢查**（待決 12）：`Settings` 新增只做驗證的 `forwarded_allow_ips` 欄位，拒絕 `*`、prefix 長度 0 的網段、host bit 非零、主機名稱與空清單，錯誤訊息不印值；代價是 Option A 不再是零應用程式碼。若不做，只在 `.env.example` 與 `architecture.mdx` 明寫「不得為 `*`」。
- **測試**（待決 3）：整合測試起真實 uvicorn 子行程（三輪：未信任、信任、多層鏈），探針路由只放在 `backend/tests/`；Compose 層候選為 P1（對 `docker compose config` 的靜態斷言）、P2（CI 用 override 跑回報檔，不放進預設編排）、或只做 P1。
- **Nginx**（待決 7）：建議只核對並更新 `frontend/nginx.conf` 第 27 至 30 行「belongs to #566」的註解，不改轉發行為，因此 `scripts/check-security-headers.sh` 不需同步。
- **文件**：`.env.example` 與 `architecture.mdx` §部署與維運（issue 驗收第 3 條）、`local-development.mdx` 環境變數表（待決 10）、`backend-modules.mdx`（是否在 apply 階段、程式合併的同一個 PR 內改，見 `system-design.md` §常駐文件異動，與規劃時先改的一般做法不同，待主 session 確認）。

**BREAKING**：無。沒有 API、資料模型、畫面或權限的變動，沒有 Alembic migration。行為變化僅限於「經編排檔起的後端，`request.client.host` 由 Nginx 位址變為原始來源」，目前沒有任何程式讀這個值（`client.host` 在 `backend/` 零命中）。測試集答案隔離不適用：不新增標記員可到達的端點，探針路由只存在於測試。

### 待決問題（尚未決定，clarification 逐題問）

以下沿用 `system-analysis.md` 的編號，已依 `system-design.md` 的實測更正事實；各題的選項比較全文見兩份文件。

| #   | 問題                                    | 實測更正後的重點                                                                                                       |
| :-- | :-------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| 1   | 信任放 uvicorn 內建處理，還是自寫中介層 | 預設已開 `--proxy-headers`；CMD 不得寫旗標（D2）；建議 A，不寫應用程式碼                                               |
| 2   | 受信任位址怎麼表達                      | 預設清單是 `127.0.0.1,::1`；私有區段預設有偽造漏洞（D12）；整段子網路讓同網路容器可偽造（E2）；建議固定 Nginx 單一位址 |
| 3   | 偽造標頭測試放哪一層                    | 必須真實 uvicorn 子行程；Compose 層見 P1、P2、P3；原始位址不可斷言為固定值                                             |
| 4   | 取得來源 IP 要不要單一入口              | 現零個消費者；建議不新增，`backend-code-boundaries` 不動                                                               |
| 5   | `X-Forwarded-Proto` 要不要信任          | 同一份清單同時管兩個標頭，「信 XFF 不信 XFP」做不到；後端 scheme 恆為 `http`；建議另案                                 |
| 6   | 存取紀錄與稽核記不記 IP                 | `server-logging` spec 明文不記來源 IP；建議維持，並更正 issue 的使用情境文字                                           |
| 7   | Nginx 設定是否在範圍                    | Nginx 已送這些標頭；建議只更新註解，不改轉發                                                                           |
| 8   | 次數限制用什麼當鍵                      | 規格 01-05 只說「同一個人」；本 change 定位為前置條件，鍵留給次數限制的 change                                         |
| 9   | 要不要在 `docs/specs/` 補規格           | 建議不補（維護者擁有，經 `spec-writing`）                                                                              |
| 10  | 沒有 Nginx 的執行方式                   | 維持 uvicorn 預設（loopback only），只有編排檔傳入 Nginx 位址                                                          |
| 11  | Cloudflare 在 Nginx 前面                | 取得的是邊緣位址而非真實用戶端（E6）；建議記為已知限制並另開 issue                                                     |
| 12  | 是否加啟動檢查                          | 靜默失效或靜默信任所有人（D4 至 D11）；建議做，代價是一個欄位、一個驗證器與約 8 條單元測試                             |

技術待決（`system-design.md`）：T1 Compose 子網段與固定位址的常數、T2 `FORWARDED_ALLOW_IPS` 是否在正式層釘死（釘死則 `.env.example` 不列此變數，issue 驗收第 3 條要調整）。

## Capabilities

是否新增 capability、改哪些既有 capability，取決於待決 1、2、3、12，因此以下為候選，clarification 之後才定案。

### New Capabilities

候選（二擇一，由維護者在 clarification 決定）：

- `trusted-proxy-client-ip`（候選 A）：持有「來源位址只在請求來自受信任代理時才採信轉發標頭；直連自帶偽造標頭不被採信」的行為 Requirement。理由：這是跨 `runtime-config`、`container-runtime` 的獨立行為，需要自己的 Scenario（直連偽造無效、經 Nginx 取得原始位址、信任範圍不含同網路其他容器）。
- 無（候選 B）：不新增，行為 Requirement 併入下列兩個既有 capability。理由：沒有端點與資料，行為皆為設定與部署層面，避免造出只有兩三條 Requirement 的小 capability。

### Modified Capabilities

候選（依決定而定）：

- `runtime-config`：待決 12 選「做啟動檢查」時有 delta（新增 `FORWARDED_ALLOW_IPS` 的有預設值、合法值與拒絕值 Requirement，錯誤訊息只列變數名）；若不做啟動檢查則無 delta。
- `container-runtime`：待決 2 選「編排檔固定網段與 Nginx 位址」時有 delta（兩層編排檔傳入同一個信任值、`.env.example` 列出該設定）。
- `server-logging`、`security-headers`、`backend-code-boundaries`：依目前建議（待決 4、6、7）皆無 delta；若維護者在待決 4 或 6 選擇擴大範圍則有。

若最後所有待決都選「最小範圍」（例如只改 `.env.example` 與文件），仍有 spec 層行為（直連偽造不被採信），不設 `skip_specs`；此判斷在 clarification 後複核。

## Impact

候選影響範圍（是否改取決於上列待決）：

- **後端**：`backend/Dockerfile` 預設不動（待決 1 選 A 時 CMD 不加旗標）；`backend/app/core/config.py`（待決 12 選啟動檢查時新增欄位與驗證器）；`backend/app/` 不新增檔案；`AccessLogMiddleware` 與 `server-logging` 不動（待決 6 建議）。
- **測試**（`backend-developer`）：`backend/tests/unit/`（`Settings` 驗證）、`backend/tests/integration/`（真實 uvicorn 子行程，三輪加啟動失敗一條；`_free_port`、`_wait_until_healthy` 可抽成共用）、`backend/tests/` 內的探針 app。
- **部署設定**（兩層同步，由 CI `docker compose config` 防漂移）：`docker-compose.yml`、`docker-compose.prod.yml`（`ipam` 子網段與 `ip_range`、`frontend` 固定位址、後端 `FORWARDED_ALLOW_IPS`）；`.github/workflows/ci.yml` 的 `compose` job（P1、P2，該 job 不列必過）與 CI 用 override 檔（若選 P2）。
- **Nginx**：`frontend/nginx.conf` 只改註解（待決 7 建議）；`scripts/check-security-headers.sh` 不需同步。
- **文件**：`.env.example`、`docs/development/architecture.mdx` §部署與維運、`docs/development/workflow/local-development.mdx` 環境變數表、`docs/diagrams/architecture/backend-modules.mdx`（§設定、§請求管線、已知限制，apply 階段改）。
- **不改**：`docs/specs/`、`docs/specs/00-prd.mdx`、`design/prototype/`、`api.openapi.json` 與前端（無 API 變更）、`error-codes.mdx`、`endpoint-authorization.mdx`、資料表與 migration。
- **風險**：Compose 子網段可能與主機既有網路或 VPN 重疊（`up` 會以 pool overlaps 明確失敗，不是靜默錯誤）；未來 uvicorn 升版可能改變取值規則（實測為 0.54.0），整合測試三輪即回歸偵測。

## 不在範圍

- 登入失敗鎖定、全域限流與其計數（規格 01-05 Q3、ADR-004 D7）：它們是本設定的消費者，另案實作；次數限制用什麼當鍵（待決 8）也留給該 change。
- 來源 IP 進存取紀錄或稽核列（待決 6）：除非 clarification 另有決定，不動 `server-logging` spec、`AccessLogMiddleware` 與 `audit_events`。
- Cloudflare 等外層邊緣代理的真實 IP 還原，以及邊緣到 origin 的 TLS 模式（ADR-008 §待決第 1 列）：只記為已知限制（待決 11）。
- `X-Forwarded-Proto` 在 TLS 邊緣之後的正確性，以及 HSTS 與 `Secure` cookie 的前提（待決 5，與 #568 耦合）：本 change 不讓協定變正確，只說明它恆為 `http`。
- 新增取得來源位址的共用函式（待決 4）：等第一個消費者出現再抽。
- `docs/specs/` 的任何需求文字與 `design/prototype/`。

## 引用來源

- GitHub issue #566（使用情境、需求目標、三條驗收條件）。
- `docs/specs/01-account/05-login-state.mdx` §規格 §登入與申請的嘗試次數、§已確認決議 Q3（來源 IP 的消費端；無對應的業務規格，見待決 9）。
- `docs/development/adr/004-auth-and-security.mdx` D7；`008-deployment-and-operations.mdx` D1、D6、§待決第 1 列；`docs/development/architecture.mdx` §部署與維運。
- `docs/development/rules/security-agent-rules.mdx` S1、S9；`docs/diagrams/architecture/backend-modules.mdx`（存取紀錄、「還沒有」風險表第 4 列）。
- `openspec/specs/server-logging/spec.md`、`container-runtime/spec.md`、`runtime-config/spec.md`、`security-headers/spec.md`、`backend-code-boundaries`。
- 本 change 的 `system-analysis.md`（待決 1 至 12、需求矛盾 1 至 4）、`system-design.md`（實測 A、C、D、E；選項與建議；§常駐文件異動；技術待決 T1 至 T5）、`ui-design.md`（無 UI 變更）、`api-contract.md`（無 API 變更）。
