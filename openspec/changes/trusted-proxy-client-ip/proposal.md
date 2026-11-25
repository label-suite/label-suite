# Proposal

## Why

`architecture.mdx` §部署與維運 規定 Nginx 是唯一公開入口，但後端目前不信任它：容器內的 uvicorn 沿用預設信任清單 `127.0.0.1,::1`，所以經 Nginx 進來的請求，`request.client.host` 一律是 Nginx 容器的位址（`system-design.md` 實測 E1：所有人共用一個來源位址）。登入嘗試限制（規格 01-05 §已確認決議 Q3、ADR-004 D7）將來要以來源 IP 當鍵時，這會讓所有人共用同一份額度；ADR-004 D7 背景表明寫「要先信任代理的來源 IP」，本 change 是它的前置條件。

issue #566 的驗收條件有兩個互相拉扯的要求：經 Nginx 要拿到原始來源，直連後端、自帶 `X-Forwarded-For` 的請求不得被採信。`system-design.md` 的實測顯示這兩件事用 uvicorn 內建機制就能達成，但有幾個靜默失敗的陷阱（私有網段預設值可被偽造、`*` 與 `0.0.0.0/0` 等於信任所有人、寫錯值不報錯），所以「信任範圍怎麼表達與驗證」才是這個 change 的重點。

這是基礎設施 change，`docs/specs/` 沒有對應的業務規格，不涉及使用者可見功能（`ui-design.md`、`api-contract.md` 皆為「無變更」）。需求依據為 issue、ADR 與規則文件條號（spec-migration D4；維護者 2026-11-20 裁定，#503）。

## What Changes

**技術事實**（以 `system-design.md` 的實測為準，更正 `system-analysis.md` 的幾處前提）：

- uvicorn 的信任清單預設是 `127.0.0.1,::1`（不是只有 `127.0.0.1`），`--proxy-headers` 預設就是開的，所以 CMD 加不加這個旗標沒有差別（實測 A1、A2）。
- 旗標會蓋掉環境變數（實測 D2），所以映像的 CMD 不得寫 `--forwarded-allow-ips`，否則編排檔傳入的 `FORWARDED_ALLOW_IPS` 會被靜默蓋掉。
- 同一份信任清單同時管 `X-Forwarded-For` 與 `X-Forwarded-Proto`（實測 C3）：「信任 XFF 但不信任 XFP」用 uvicorn 內建機制做不到。Nginx 在 TLS 邊緣之後仍送 `$scheme`（`http`，且會覆寫外部帶的值，實測 E4），所以後端的 `scope["scheme"]` 恆為 `http`，與現況相同，不是更糟。
- Nginx 已經送 `X-Forwarded-For`、`X-Forwarded-Proto`、`X-Real-IP`、`X-Forwarded-Host`（`frontend/nginx.conf:64-68`）；`$proxy_add_x_forwarded_for` 把真實 peer append 在最右側，uvicorn 取最右側不受信任者，所以外部預先放入的鏈不影響結果（實測 E4、E6）。
- 預設信任私有位址區段（`10/8`、`172.16/12`、`192.168/16`）有已證實的偽造漏洞（實測 D12：真實用戶端落在受信任的私有網段時，偽造值被採信）；信任整段 Compose 子網路則讓同網路任何容器都能偽造（實測 E2）。
- `*`、`0.0.0.0/0` 都等於信任所有人；host bit 非零（`127.0.0.1/8`）、拼錯、主機名稱都被靜默忽略，uvicorn 不報錯（實測 D4 至 D11）。
- 現有 `client` fixture 是 httpx 直接接 ASGI，不經 uvicorn 的中介層，無法證明驗收條件；要起真實 uvicorn 子行程。Docker 發布埠的來源位址依平台不同（Docker Desktop 為 `192.168.65.1`，Linux 未測），所以不能斷言「經 Nginx 看到的位址等於某個值」。

**決定的工作項**（決議見 `clarification.md`，編號對應其 Q、T、D）：

- **信任設在 uvicorn 內建處理**（Q1）：以原生環境變數 `FORWARDED_ALLOW_IPS` 提供信任清單；`backend/Dockerfile` 的 `CMD` 不加任何代理旗標、不寫應用程式碼。
- **只信任 Nginx 的單一固定位址**（Q2、T1、T2）：`docker-compose.yml` 與 `docker-compose.prod.yml` 各宣告預設網路的 `ipam`（`subnet` 加只供動態配位的 `ip_range`），固定 `frontend` 服務的 `ipv4_address`；子網段選 Docker 預設位址池以外的 `/24`（例如 `10.77.250.0/24`，實作時以 `docker compose config` 與實際 `up` 驗證），兩層同一組常數。後端 `FORWARDED_ALLOW_IPS` 預設為該位址，寫成 `${FORWARDED_ALLOW_IPS:-<固定位址>}`，正式層不釘死，`.env.example` 列出此變數。
- **沒有 Nginx 的執行方式維持 uvicorn 預設**（Q10）：只信任 `127.0.0.1,::1`，只有編排檔傳入 Nginx 位址；`.env.example` 說明「放在代理後面才設、直接暴露時不要設」。
- **啟動檢查**（Q12）：`Settings` 新增只做驗證的 `forwarded_allow_ips` 欄位，預設 `127.0.0.1,::1`；拒絕 `*`、前綴長度 0 的網段、主機位元不為零的 CIDR、主機名稱與空清單；錯誤訊息只寫變數名、不印值（比照 CORS）。
- **測試**（Q3）：真實 uvicorn 子行程的 integration 測試（比照 `test_access_log.py`），三輪：不受信任來源帶偽造標頭被忽略、受信任來源取到轉發位址、多段鏈取右到左第一個不受信任位址；探針路由只放在 `backend/tests/`。編排層做 P1 加 P2：P1 在 CI `compose` job 對 `docker compose config` 的 JSON 做靜態斷言（兩層的值不是 `*`、涵蓋 `frontend` 的固定位址，`nginx.conf` 仍附加 `X-Forwarded-For`）；P2 用只給 CI 的 override 檔在 Lite 層實際送一般與偽造請求，斷言回報的位址不是 Nginx 位址、也不是偽造值（只做否定斷言，不斷言固定值）。
- **Nginx**（Q7）：只核對並更新 `frontend/nginx.conf` 第 27 至 30 行的註解，不改轉發寫法；`scripts/check-security-headers.sh` 不需同步。
- **文件**：`.env.example`、`architecture.mdx` §部署與維運（含 `X-Forwarded-Proto` 在 TLS 邊緣後面與 Cloudflare 的已知限制，Q5、Q11）、`local-development.mdx` 環境變數表；`backend-modules.mdx` 的設定表、請求流程與已知限制依決議 D，在本 change 實作階段的同一張 PR 內改（該文件只記已合併的程式，規劃與程式同 PR 合併，不會出現文件先於程式的落差）。

**BREAKING**：無。沒有 API、資料模型、畫面或權限的變動，沒有 Alembic migration。行為變化僅限於「經編排檔起的後端，`request.client.host` 由 Nginx 位址變為原始來源」，目前沒有任何程式讀這個值（`client.host` 在 `backend/` 零命中）。測試集答案隔離不適用：不新增標記員可到達的端點，探針路由只存在於測試。

### 決議摘要

十二題待決與 T1、T2、D 已於 `clarification.md` 依維護者 2026-11-25 的授權決定（2026-11-26）；選項比較與理由見該檔與 `system-design.md`，這裡只列結論。

| #   | 題目                         | 結論                                                                      |
| :-- | :--------------------------- | :------------------------------------------------------------------------ |
| Q1  | 信任放哪裡                   | uvicorn 內建處理，`FORWARDED_ALLOW_IPS`；`CMD` 不加旗標                   |
| Q2  | 受信任位址                   | 只信任 Nginx 單一固定位址（固定網段加 `ipv4_address`）                    |
| Q3  | 測試層                       | 真實 uvicorn 子行程 integration 測試；編排層 P1 加 P2                     |
| Q4  | 來源 IP 單一入口             | 不新增，`backend-code-boundaries` 不動                                    |
| Q5  | `X-Forwarded-Proto`          | 不另外處理；scheme 恆為 `http`，限制記入 `architecture.mdx`，不另開 issue |
| Q6  | 存取紀錄與稽核記 IP          | 維持 `server-logging` 不記來源 IP；PR 註明更正 issue 使用情境文字         |
| Q7  | Nginx 設定                   | 只更新註解                                                                |
| Q8  | 次數限制的鍵                 | 本 change 不決定，留給次數限制的 change                                   |
| Q9  | `docs/specs/` 補規格         | 不補                                                                      |
| Q10 | 沒有 Nginx 的執行方式        | 維持 uvicorn 預設（loopback only）                                        |
| Q11 | Cloudflare 在 Nginx 前面     | 記為已知限制，歸到 ADR-008 待決，不另開 issue                             |
| Q12 | 啟動檢查                     | 做                                                                        |
| T1  | 子網段與固定位址             | Docker 預設位址池以外的 `/24`，兩層同一組                                 |
| T2  | 正式層是否釘死               | 不釘死，`.env.example` 列出，編排檔給預設值                               |
| D   | `backend-modules.mdx` 的時機 | 本 change 實作階段的同一張 PR 內改                                        |

## Capabilities

### New Capabilities

- `trusted-proxy-client-ip`：持有三組行為 Requirement：經 Nginx 時後端取得原始來源位址；直接連到後端並自帶 `X-Forwarded-For` 的請求不被採信；多段轉發鏈取右到左第一個不受信任的位址（沒有 Nginx 時只信任 loopback）。

### Modified Capabilities

- `runtime-config`：新增 `FORWARDED_ALLOW_IPS` 的啟動檢查 Requirement（預設值、合法值、拒絕 `*`、前綴長度 0、主機位元不為零、主機名稱與空清單；錯誤訊息只寫變數名、不印值）。
- `container-runtime`：兩層編排檔宣告固定網段、`frontend` 固定位址，後端只信任該位址，並在 `.env.example` 列出 `FORWARDED_ALLOW_IPS`。

`server-logging`、`security-headers`、`backend-code-boundaries` 無 delta（Q4、Q6、Q7）。

## Impact

- **後端**：`backend/Dockerfile` 不動（`CMD` 不加旗標）；`backend/app/core/config.py`（新增 `forwarded_allow_ips` 欄位與驗證器）；`backend/app/` 不新增檔案；`AccessLogMiddleware` 與 `server-logging` 不動。
- **測試**（`backend-developer`）：`backend/tests/unit/`（`Settings` 驗證）、`backend/tests/integration/`（真實 uvicorn 子行程，三輪加啟動失敗一條；`_free_port`、`_wait_until_healthy` 可抽成共用）、`backend/tests/` 內的探針 app。
- **部署設定**（兩層同步，由 CI `docker compose config` 防漂移）：`docker-compose.yml`、`docker-compose.prod.yml`（`ipam` 子網段與 `ip_range`、`frontend` 固定位址、後端 `FORWARDED_ALLOW_IPS`）；`.github/workflows/ci.yml` 的 `compose` job（P1、P2，該 job 不列必過）與只給 CI 的 override 檔。
- **Nginx**：`frontend/nginx.conf` 只改註解；`scripts/check-security-headers.sh` 不需同步。
- **文件**：`.env.example`、`docs/development/architecture.mdx` §部署與維運、`docs/development/workflow/local-development.mdx` 環境變數表、`docs/diagrams/architecture/backend-modules.mdx`（設定表、請求流程、已知限制；依決議 D 在實作 PR 內改）。
- **不改**：`backend/Dockerfile`、`docs/specs/`、`docs/specs/00-prd.mdx`、`design/prototype/`、`api.openapi.json` 與前端（無 API 變更）、`error-codes.mdx`、`endpoint-authorization.mdx`、資料表與 migration。
- **風險**：Compose 子網段可能與主機既有網路或 VPN 重疊（`up` 會以 pool overlaps 明確失敗，不是靜默錯誤）；未來 uvicorn 升版可能改變取值規則（實測為 0.54.0），整合測試三輪即回歸偵測。

## 不在範圍

- 登入失敗鎖定、全域限流與其計數（規格 01-05 Q3、ADR-004 D7）及其使用什麼當鍵（Q8）：它們是本設定的消費者，另案實作。
- 來源 IP 進存取紀錄或稽核列（Q6）：不動 `server-logging` spec、`AccessLogMiddleware` 與 `audit_events`。
- `X-Forwarded-Proto` 在 TLS 邊緣之後的正確性、Cloudflare 的真實 IP 還原與邊緣到 origin 的 TLS 模式（Q5、Q11；ADR-008 §待決第 1 列，與 #568 耦合）：只記為已知限制，不另開 issue。
- 新增取得來源位址的共用函式（Q4）：等第一個消費者出現再抽。
- `docs/specs/` 的任何需求文字（Q9）、`docs/specs/00-prd.mdx` 與 `design/prototype/`。

## 引用來源

- GitHub issue #566（使用情境、需求目標、三條驗收條件）。
- `docs/specs/01-account/05-login-state.mdx` §規格 §登入與申請的嘗試次數、§已確認決議 Q3（來源 IP 的消費端；無對應的業務規格，見待決 9）。
- `docs/development/adr/004-auth-and-security.mdx` D7；`008-deployment-and-operations.mdx` D1、D6、§待決第 1 列；`docs/development/architecture.mdx` §部署與維運。
- `docs/development/rules/security-agent-rules.mdx` S1、S9；`docs/diagrams/architecture/backend-modules.mdx`（存取紀錄、「還沒有」風險表第 4 列）。
- `openspec/specs/server-logging/spec.md`、`container-runtime/spec.md`、`runtime-config/spec.md`、`security-headers/spec.md`、`backend-code-boundaries`。
- 本 change 的 `system-analysis.md`（待決 1 至 12、需求矛盾 1 至 4）、`system-design.md`（實測 A、C、D、E；選項與建議；§常駐文件異動；技術待決 T1 至 T5）、`ui-design.md`（無 UI 變更）、`api-contract.md`（無 API 變更）。
