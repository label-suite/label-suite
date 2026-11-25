# Design

## Context

動機見 proposal.md §Why；十二題 Q、T1、T2、D 的決議與理由全文見 `clarification.md` §待釐清項目（2026-11-26，維護者 2026-11-25 授權採建議，可依 Q 編號推翻回修），本文件不重述理由。實測、選項比較、類別與三張 Sequence Diagram、測試設計見 `system-design.md`；本文件只寫那邊沒有定下的決策、取捨與已知限制。`api-contract.md`、`ui-design.md` 皆為「無變更」。

現況限制（`origin/main`，2026-11-26）：

- `backend/Dockerfile` 的 `CMD` 以 uvicorn `--factory` 起 `app.main:create_app`，沒有任何代理旗標；`docker-compose.yml` 與 `docker-compose.prod.yml` 的後端 `environment` 只傳 `CORS_ALLOWED_ORIGINS`、`CORS_ALLOW_CREDENTIALS`、`SQLITE_PATH`（正式層另有資料庫設定）與 `LOG_LEVEL`，網路用 Compose 預設，沒有固定位址。
- `Settings` 已有 `cors_allowed_origins` 的逗號分隔驗證器與只印變數名的 `ConfigError` 慣例；`backend/tests/integration/test_access_log.py` 已有 `_free_port`、`_wait_until_healthy` 與起 uvicorn 子行程的寫法。
- CI 的 `compose` job 已對兩層各產生 `docker compose config --format json`，並起 Lite 與正式層做 e2e；該 job 不列必過。
- 沒有任何程式讀 `request.client.host`（`backend/` 零命中）。

## Goals / Non-Goals

**Goals:**

- 經 Nginx 的請求，後端看到的來源位址是原始位址，不是 Nginx 的位址（issue 驗收 1）。
- 直接連到後端並自帶 `X-Forwarded-For` 的請求不被採信（驗收 2）；多段鏈取右到左第一個不受信任的位址。
- 信任範圍寫進 `.env.example` 與編排檔，預設只信任 Nginx 的單一固定位址（驗收 3）。
- 危險或寫壞的 `FORWARDED_ALLOW_IPS` 在啟動時就失敗，而不是靜默放行或靜默失效。

**Non-Goals:**

- 次數限制本身與它的鍵（Q8）、來源 IP 進存取紀錄或稽核（Q6）、共用的來源位址入口（Q4）。
- TLS 邊緣之後的 scheme 與 Cloudflare 的真實位址還原（Q5、Q11，記為已知限制）。
- `docs/specs/`、`00-prd.mdx`、`design/prototype/`、`backend/Dockerfile`、`openapi.json` 與前端。

## Decisions

### D1 信任交給 uvicorn 內建處理，環境變數 `FORWARDED_ALLOW_IPS`，`CMD` 不加旗標（Q1；system-design §設計決定與選項「信任放哪裡」）

沿用 uvicorn 原生變數名，不自訂別名。實測 D2 顯示旗標會蓋掉環境變數，所以 `CMD` 不得寫 `--forwarded-allow-ips`；實測 A1、A2 顯示 `--proxy-headers` 預設就開，寫不寫沒有差別，所以也不寫。uvicorn 把中介層包在整個 app 的最外層，`CorrelationId`、`AccessLog` 與所有路由看到的 `scope["client"]` 都已改寫，應用程式不需處理。替代方案（自寫中介層，約 60 行加測試、與 uvicorn 的中介層重複）見 system-design 選項 B，不採用。

### D2 只信任 Nginx 的單一固定位址：固定網段、`ip_range`、釘住 `frontend`（Q2、T1、T2；system-design §「編排檔傳什麼」A1、技術待決 T1、T2）

兩份編排檔各宣告預設網路的 `ipam`（`subnet` 加 `ip_range`），`frontend` 服務指定 `ipv4_address`，後端 `FORWARDED_ALLOW_IPS` 預設 `${FORWARDED_ALLOW_IPS:-<frontend 的固定位址>}`，正式層不釘死（T2）。**常數只定到「Docker 預設位址池以外的 `/24`，動態配位限後半，`frontend` 固定在前半」這個形狀**；具體值（`10.77.250.0/24`、`10.77.250.128/25`、`10.77.250.10` 只是 system-design T1 的例子）於實作時以 `docker compose config` 與實際 `up` 驗證後才定，兩層同一組。信任整段子網路會讓同網路其他容器可偽造（實測 E2）、預設信任私有網段有已證實的偽造漏洞（實測 D12）、uvicorn 不解析容器名稱（實測 D11），三者都不採用。

取捨：子網段可能與主機既有網路或 VPN 重疊，`up` 會以位址池重疊明確失敗而非靜默錯誤，`.env.example` 說明如何改（兩層與 `FORWARDED_ALLOW_IPS` 要一起改）。變數引用同一個常數避免漂移的做法留給實作決定；兩份檔分別寫的既有慣例由 CI 的 P1 防漂移。

### D3 啟動檢查：`Settings.forwarded_allow_ips` 只驗證、不被後端使用（Q12；system-design §「啟動檢查」）

規則見 specs `runtime-config`。驗證規則刻意與 uvicorn 的比對一致，才不會「檢查過了卻沒生效」：用 `ipaddress` 判斷單一位址與嚴格網段（擋實測 D9），拒絕 `*`、前綴長度 0（擋 D4、D10）、主機名稱與其他 literal（擋 D6、D11）、空清單（D5）與空項目。預設值 `127.0.0.1,::1` 與 uvicorn 預設相同，沒設環境變數時行為不變。`create_app` 在 uvicorn 包中介層之前被呼叫（`--factory`），所以後端自己讀同一個環境變數就能擋。不拒絕「很寬但不是全部」的網段（例 `10.0.0.0/8`）：什麼算太寬是部署決定。此決定使 Q1 不再是「零應用程式碼」，成本是一個欄位、一個驗證器與單元測試。

### D4 測試分層：真實 uvicorn 子行程三輪，加編排層 P1 與 P2（Q3；system-design §測試設計）

- **整合測試**：子行程起 `tests.integration.<探針模組>:create_forwarded_probe_app --factory`，探針模組放在 `backend/tests/integration/`、檔名不以 `test_` 開頭（不被收集、不在 `app/`，production 不載入；比照 `probe.py` 的先例）。三輪對應 specs：未信任（`FORWARDED_ALLOW_IPS=192.0.2.1`）、受信任（`127.0.0.1`）、多層鏈。**「未信任」那一輪不能用不設環境變數**（實測 A1：預設清單含測試用戶端的 loopback），「預設是 loopback only」改由單元測試斷言 `Settings`。另有一條啟動失敗測試（`*`）。子行程帶自己的 `SQLITE_PATH`，SQLite 與 PostgreSQL 行為相同，不另開 PostgreSQL 版。
- **P1**（靜態，必做）：CI `compose` job 對既有的 `docker compose config --format json` 加斷言，涵蓋 specs `container-runtime` 的兩個 Requirement，並確認 `frontend/nginx.conf` 仍含 `X-Forwarded-For $proxy_add_x_forwarded_for`。
- **P2**（執行期，Lite 層一次）：只給 CI 用的 override 檔把後端 `command` 換成映像內的 uvicorn 跑一個掛進去的回報用 ASGI 檔；CI 送一般與偽造請求，只做否定斷言（回報位址不是 `frontend` 的固定位址、不是偽造值），因為發布埠的來源位址依平台而異（Docker Desktop 為 `192.168.65.1`，Linux 未測）。回報檔只存在於這個 override，不進映像與預設編排。override 與回報檔放 `scripts/` 或 `e2e/` 下，實作時擇一並在 task 記錄。
- **誰負責 `.github/`**：`[@backend-developer]` 負責 `ci.yml` 與 P2 檔案。`rules.tasks` 只有四個角色，不新增角色；編排檔與 CI 屬同一個基礎建設單位（既有的 `compose` job 與兩份編排檔皆由後端相關 task 維護）。
- **已知缺口**：「同網路其他容器直連後端偽造無效」只有實測 E4 與 P1 的靜態斷言（預設只信任單一位址）支持，P2 沒有從第三個容器發請求；不新增這一步，避免超出 system-design 的測試設計。若維護者要執行期證明，回 Q3 加一步。
- **uvicorn 升版**：取值規則（右到左、`*` 反轉）是 0.54.0 的實測；整合測試的三輪就是升版時的回歸偵測，不另外 pin（T5）。

### D5 Nginx 只改註解（Q7；system-design §「Nginx 範圍」）

`$proxy_add_x_forwarded_for` 把真實對端 append 在最右側，uvicorn 取最右側不受信任者，用戶端預先放入的鏈不影響結果（實測 E4、E6），所以不改轉發寫法、不覆寫成 `$remote_addr`。只把 `frontend/nginx.conf` 第 27 至 30 行「belongs to #566」的註解改成已決定的內容（後端信任 Nginx 的 `X-Forwarded-For` 與 `X-Forwarded-Proto`，協定在 TLS 邊緣之後仍是 `http`）。不動轉發與安全標頭，`scripts/check-security-headers.sh` 不需要同步。

### D6 常駐文件在同一張 PR 內改（決議 D；system-design §常駐文件異動）

`backend-modules.mdx` 只記已合併的程式，所以規劃階段不改它，在實作階段與程式同一張 PR 內改：後端基礎建設 §設定新增 `FORWARDED_ALLOW_IPS` 一列（註明只做驗證、比對由 uvicorn 完成）、§請求管線加註 uvicorn 的 `ProxyHeadersMiddleware` 在 app 的五個中介層之外、已知限制刪掉「信任反向代理的來源 IP」那一列並改記 Cloudflare 與 TLS 邊緣。非常駐的 `architecture.mdx` §部署與維運、`.env.example`、`local-development.mdx` 環境變數表與 `nginx.conf` 註解列在 tasks，由 `[@technical-writer]` 在程式落地後撰寫，內容引用實際落地的位址常數。

### D7 文件檢查不在 worktree 跑 NoteCraft 建置（對 `openspec/config.yaml` operations.apply 的明示偏離）

沿用 `2026-11-26-backend-entry-import-contracts` design D10 與 #562 的先例：指向 worktree 的 `pnpm exec notecraftapp build docs --rebuild` 會污染共用快取。動到 `docs/` 的 task 改以 `node scripts/check-specs.mjs docs`、`node scripts/check-citations.mjs --strict` 與 `pnpm format:check` 收尾，渲染驗證交給 CI 的 `docs-site` job。

## 實測事實（以 uvicorn 0.54.0、Docker Desktop 29.2.1 為準，細節見 system-design §實測）

- 信任清單預設 `127.0.0.1,::1`，`--proxy-headers` 預設就開（A1、A2）；旗標覆蓋環境變數（D2）。
- 取值規則是**從右往左取第一個不在清單內的位址**（C1、C2）；`*` 同時信任所有人並把取值改成最左側（D4）；`0.0.0.0/0` 也等於信任所有人（D10）。
- 格式錯誤（主機位元非零、拼錯、主機名稱）不報錯，靜默丟棄（D6 至 D9、D11）；對端不在清單內時整個標頭不看（B）。
- 同一份清單同時管 `X-Forwarded-For` 與 `X-Forwarded-Proto`（C3）；Nginx 的 `$scheme` 覆寫外部帶的值（E4）。
- 改寫後的 `scope["client"]` 埠是 0（C4）。

## Risks / Trade-offs

- **已知限制**（寫進 `architecture.mdx` §部署與維運與 `backend-modules.mdx` 已知限制，不另開 issue）：
  - TLS 邊緣之後後端的 scheme 恆為 `http`，與今天相同（Q5）；要變成正確的 `https` 取決於 ADR-008 尚未決定的 Cloudflare TLS 模式。
  - Cloudflare 或其他邊緣代理在 Nginx 前面時，拿到的是邊緣位址而不是真實用戶端（實測 E6、Q11）；還原需要 Nginx 的 real_ip 設定，屬 ADR-008 範圍。
  - Docker 發布埠的來源位址依平台而異（Docker Desktop 為 `192.168.65.1`，Linux 未測），所以測試不斷言固定值。
- **子網段重疊**：與主機既有網路或 VPN 重疊時 `up` 失敗（明確失敗，見 D2）。
- **設定寫錯的症狀**：編排檔沒傳或傳錯時，後端回到「所有人共用 Nginx 位址」（system-design Sequence Diagram 的 else 分支），沒有錯誤訊息；P2 與 P1 是偵測它的方式。
- **uvicorn 升版改變取值規則**：由三輪整合測試偵測（D4）。
- **Settings 驗證與 uvicorn 比對不一致**：兩者讀同一個變數、規則刻意對齊；不一致時的最壞情況是檢查過了但 uvicorn 靜默失效（fail closed），不會變成信任所有人，因為 `*` 與前綴長度 0 一律拒絕。
- **行為變化**：經編排檔起的後端，`request.client.host` 由 Nginx 位址變為原始來源；目前零個消費者，沒有可見影響。授權不得讀這個值（security-agent-rules S1）。

## Migration Plan

沒有資料模型異動、沒有 Alembic migration、沒有 API 或畫面變動。部署上唯一的變動是兩份編排檔的預設網路改為固定子網段，既有部署第一次 `docker compose up` 會需要以新設定重建網路與容器；volume 與資料不受影響。實作時以實際 `up` 驗證既有舊網路存在時的行為，結果記在對應 task 的提交訊息，**未驗證前不寫成保證**。回滾：還原本 PR 即回到動態網路與 uvicorn 預設（loopback only）；環境變數 `FORWARDED_ALLOW_IPS` 不再被讀，不留殘餘狀態。

## Open Questions

無需維護者新決定的項目。已知缺口（第三個容器的執行期偽造測試，D4）與 T1 常數的實測驗證是實作階段的工作，不是待決。
