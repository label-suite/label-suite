# Tasks

本 change 沒有 schema 變更、沒有 API 變更、沒有畫面變更（`api-contract.md`、`ui-design.md`、system-design §資料模型異動），所以沒有 `[@dba]` task，也不重新產生 `openapi.json` 與前端型別；動到 `backend/` 的群組以後端契約漂移指令確認「沒有差異」收尾。JavaScript 指令在 repo 根目錄以 `pnpm` 執行，Python 在 `backend/` 以 `uv`；不得出現 npm install 或 pip install，本 change 不新增任何相依套件。`backend/Dockerfile` 不改（design D1）。

**提交規則**：每個群組完成後提交一次，訊息依 AGENTS.md §Commits（`<type>: <subject> (#566)`、body 每點以粗體動詞開頭、動詞後不加冒號），結尾**恰好一個** `Co-Authored-By` trailer 標明模型。commit 被 hook 擋下時修正後重新 `git commit`，**不得** `--amend`；push 前以 `git log origin/main..HEAD` 確認只有本分支的 commit。

**先證明檢查會失敗**（clarification §交給後續產出）：每個 `[@backend-developer]` 群組都先寫測試或斷言，對刻意違規（偽造標頭、`FORWARDED_ALLOW_IPS=*`）跑出失敗，再補實作跑到通過；刻意違規以暫時修改做，還原後 `git diff` 只剩本 task 的改動，指令與失敗輸出摘要記在該組的提交訊息。

**測試檔大小**：新增與修改的 Python 測試檔每個不超過 400 行（B11，由 `backend/tests/unit/test_size_limits.py` 檢查）。

**常數**：子網段、動態配位範圍與 `frontend` 固定位址的值只在第 3 組定一次（形狀見 design D2），後續群組與文件引用實際落地的值；system-design T1 的 `10.77.250.0/24`、`10.77.250.10` 只是例子，實作時以 `docker compose config` 與實際 `up` 驗證。

**`.github/` 的負責角色**：`ci.yml` 與 P2 檔案由 `[@backend-developer]` 負責（design D4），不新增角色。

順序：第 1 組的 `Settings` 欄位先落地，第 2 組的啟動失敗整合測試才能依賴它；第 3 組定常數與兩份編排檔，第 4 組的 P2 與第 5 組的文件都引用它；文件最後。第 1、2 組與第 3 組之間沒有相依，但為避免同時改 `backend/` 與編排檔造成提交混雜，依編號順序執行。

## 1. `Settings.forwarded_allow_ips` 與啟動檢查

本組完成後，`Settings` 有只做驗證的 `forwarded_allow_ips`，非法值讓服務拒絕啟動，錯誤訊息只含變數名。建議訊息 `feat: validate the trusted proxy address list at startup (#566)`。

- [x] 1.1 依 design D3（clarification Q12；specs `runtime-config` 的「信任代理的位址清單在啟動時驗證」「信任清單的錯誤訊息只指出變數名與原因」與 MODIFIED「其餘設定都有預設值」），以 TDD 在 `backend/app/core/config.py` 新增 `forwarded_allow_ips` 與驗證器（寫法比照 `cors_allowed_origins`，只驗證、後端不使用其值），單元測試放 `backend/tests/unit/`。**先寫測試並跑出失敗**：欄位還不存在時，`cd backend && uv run pytest` 的對應單元測試先失敗；案例為 `*`、`0.0.0.0/0`、`::/0`、`127.0.0.1/8`、`localhost`、`1.2.3.4,,5.6.7.8`、空字串各自拒絕，合法的單一位址、CIDR、帶空白清單、`127.0.0.1,10.0.0.0/8`，未設定時預設恰為 `["127.0.0.1", "::1"]`，以及 `FORWARDED_ALLOW_IPS=CANARY-host.example` 的錯誤訊息含 `FORWARDED_ALLOW_IPS` 且不含 `CANARY-host.example`。故意弄壞：暫時讓驗證器放行 `*`，確認對應案例失敗，還原 [@backend-developer]
- [x] 1.2 本組收尾：`cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy --strict app && uv run lint-imports && uv run pytest` 全部以 0 結束，回報 pytest 摘要的 passed 與 skipped 數；後端契約漂移指令（`openspec/config.yaml` operations.apply）沒有差異，與 `api-contract.md`「本次無 API 變更」一致；`pnpm format:check` 以 0 結束 [@backend-developer]

## 2. 真實 uvicorn 子行程的整合測試

本組完成後，三輪子行程測試與一條啟動失敗測試守住「偽造標頭不被採信、受信任對端取原始位址、多段鏈取右到左」，也是 uvicorn 升版的回歸偵測（design D4）。建議訊息 `test: prove trusted proxy handling with a real uvicorn process (#566)`。

- [x] 2.1 依 design D4（clarification Q3），以 TDD 把 `backend/tests/integration/test_access_log.py` 的 `_free_port`、`_wait_until_healthy` 抽成同目錄下不以 `test_` 開頭的共用模組並讓原檔改為匯入；注意 `test_access_log.py` 依 B11 的計算目前已是 399 行，**先抽出共用的 helper 再往任何檔案加東西**，不得先加後抽；完成判定：抽出前後 `cd backend && uv run pytest tests/integration/test_access_log.py` 的通過數相同 [@backend-developer]
- [x] 2.2 依 design D4（specs `trusted-proxy-client-ip` 的全部 Scenario 中標「真實的 uvicorn 子行程」者），以 TDD 新增測試專用探針模組 `backend/tests/integration/` 底下不以 `test_` 開頭的檔案（`create_forwarded_probe_app`：呼叫 `create_app` 後再掛一條回報 `request.client.host` 與 `request.url.scheme` 的路由，不放在 `app/`）與測試檔，三輪加協定與兩行標頭案例：未信任（`FORWARDED_ALLOW_IPS=192.0.2.1`，`X-Forwarded-For: 6.6.6.6` 與 `X-Forwarded-Proto: https` 都被忽略，回報 `127.0.0.1` 與 `http`）、受信任（`127.0.0.1`，`5.5.5.5` 與 `https` 被採用）、多層鏈（`6.6.6.6, 5.5.5.5, 127.0.0.1` 得 `5.5.5.5`）、兩行 `X-Forwarded-For`（`6.6.6.6` 與 `7.7.7.7` 得 `7.7.7.7`）、以不帶旗標的環境變數指定清單時生效（specs「環境變數指定的信任清單在映像啟動時生效」：`FORWARDED_ALLOW_IPS=192.0.2.1`、從 loopback 帶 `X-Forwarded-For: 5.5.5.5`，斷言回報 `127.0.0.1` 而不是 `5.5.5.5`；同一請求在預設清單下回報 `5.5.5.5`，所以此案例會因環境變數沒生效而失敗）；子行程各帶自己的 `SQLITE_PATH` 與 `CORS_ALLOWED_ORIGINS`。**先證明會失敗**：把「未信任」那一輪暫時改成 `FORWARDED_ALLOW_IPS=*`（刻意違規），確認斷言失敗並回報 `6.6.6.6`，還原後通過。另以單元測試或檔案內容斷言 `backend/Dockerfile` 的 `CMD` 不含 `--forwarded-allow-ips`、`--proxy-headers`、`--no-proxy-headers`（specs「映像的啟動指令不帶信任清單旗標」） [@backend-developer]
- [x] 2.3 依 design D3、D4（specs `runtime-config`「含星號時以真實 uvicorn 啟動失敗並點名變數」；依賴 1.1），以 TDD 加子行程啟動失敗測試，以 `pytest.mark.parametrize` 涵蓋 specs 的七個壞值（`*`、`0.0.0.0/0`、`::/0`、`127.0.0.1/8`、`localhost`、`1.2.3.4,,5.6.7.8`、空字串）：每個值下子行程以非零狀態結束、輸出含 `FORWARDED_ALLOW_IPS`、沒有開始接受請求。故意弄壞：暫時拿掉 1.1 的 `*` 拒絕，確認此測試失敗，還原 [@backend-developer]
- [x] 2.4 本組收尾：`cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy --strict app && uv run lint-imports && uv run pytest` 全部以 0 結束，回報 passed 與 skipped 數；以本機 `docker run postgres:16` 提供 `TEST_DATABASE_URL` 再跑一次 `uv run pytest`，skipped 為 0（本機沒有 Docker 時停下回報）；契約漂移指令沒有差異；`git diff origin/main -- backend/app` 只含 1.1 的 `config.py`（不含 `Dockerfile`）；新增與修改的測試檔各不超過 400 行 [@backend-developer]

## 3. 兩份編排檔與 P1 靜態斷言

本組完成後，兩層編排都有固定子網段與釘住的 `frontend` 位址，後端預設只信任該位址，CI 對兩層做靜態斷言。建議訊息 `feat: trust only the frontend address behind a fixed compose network (#566)`。

- [x] 3.1 依 design D4 的 P1（clarification Q3；specs `container-runtime` 的兩個新 Requirement 與 `trusted-proxy-client-ip`「Nginx 以附加方式轉發 X-Forwarded-For」），以 TDD 在 `.github/workflows/ci.yml` 的 `compose` job 既有的「Assert the structure of both orchestration files」步驟加斷言（沿用該步驟已產生的 `lite.json`、`prod.json`）：兩層預設網路有 `ipam` 的 `subnet` 與 `ip_range`、兩層的值相同；`frontend` 有 `ipv4_address` 且在 `subnet` 內、不在 `ip_range` 內；後端 `FORWARDED_ALLOW_IPS` 等於 `frontend` 的 `ipv4_address` 且不是 `*`、不含前綴長度 0 的網段；子網段不在 `172.16.0.0/12` 與 `192.168.0.0/16` 內（specs「子網段在 Docker 預設位址池之外」）；以兩個 `--env-file` 疊加（先 `--env-file .env`，再 `--env-file <暫存檔>`，暫存檔內容 `FORWARDED_ALLOW_IPS=192.0.2.7`；單一 `--env-file` 會取代預設的 `.env`，使 `CORS_ALLOWED_ORIGINS` 等 `${…:?…}` 必填變數消失而在斷言前就失敗）對兩層各跑 `docker compose --env-file .env --env-file <暫存檔> config --format json`，斷言後端的值是 `192.0.2.7`、必填變數仍在（CI 的 `compose` job 以「Copy the example environment file」步驟 `cp .env.example .env` 供應基底，正式層另以 shell 的 `POSTGRES_PASSWORD` 供應密碼，疊加沿用這兩者；specs「.env 的值覆寫預設」）；`frontend/nginx.conf` 仍含 `X-Forwarded-For $proxy_add_x_forwarded_for`。**先證明會失敗**：斷言以可在本機執行的 shell 片段先對現況兩份編排檔（尚無 `ipam`）跑出失敗；3.2、3.3 完成後通過；再以暫時把某層的 `FORWARDED_ALLOW_IPS` 預設改成 `*` 確認斷言失敗，還原 [@backend-developer]
- [x] 3.2 依 design D2（clarification Q2、T1、T2），在 `docker-compose.yml` 加預設網路的 `ipam`（`subnet` 與只供動態配位的 `ip_range`）、`frontend` 的 `ipv4_address`，後端 `environment` 加 `FORWARDED_ALLOW_IPS: ${FORWARDED_ALLOW_IPS:-<frontend 的固定位址>}`，並以註解指向 #566 與 design D2；`migrate` 不加此變數。常數的具體值在這裡定：先以 `docker compose config` 驗證可展開，再以 `docker compose up --build --wait --wait-timeout 300` 實測 `frontend` 取得固定位址、`ip_range` 內動態配位的容器不與之衝突，把值與驗證指令記在提交訊息 [@backend-developer]
- [x] 3.3 依 design D2，在 `docker-compose.prod.yml` 做同樣的改動，值與 3.2 完全相同（兩層同一組）；正式層以 `POSTGRES_PASSWORD="$(...)" docker compose -f docker-compose.prod.yml config` 驗證可展開並實際 `up` 一次，確認 3.1 的斷言通過。同時實測並記錄「既有的舊預設網路存在時再次 `up`」的行為（design §Migration Plan），不把結果寫成保證；並記錄「兩層共用同一子網段，不能同時運行；只 `stop` Lite 層而未 `down` 時正式層 `up` 會以 `Pool overlaps with other one on this address space` 失敗」的實測（design §Risks） [@backend-developer]
- [x] 3.4 本組收尾：`docker compose config --quiet` 與正式層的同指令以 0 結束；3.1 的斷言對兩層通過；`pnpm format:check` 以 0 結束；`git status --porcelain` 只含本組的檔案 [@backend-developer]

## 4. P2：Lite 層的執行期證明

本組完成後，CI 在 Lite 層實際送一般與偽造請求，證明「經 Nginx 拿到的來源位址不是 Nginx 的位址，也不是偽造值」。建議訊息 `test: prove client address handling through nginx in compose ci (#566)`。

- [x] 4.1 依 design D4 的 P2（clarification Q3；specs `trusted-proxy-client-ip` 中標「Lite 編排的探針」者），以 TDD 新增只給 CI 用的 compose override 檔與一個回報 `client` 與 `scheme` 的 ASGI 檔，放在 `scripts/` 或 `e2e/` 底下擇一（在提交訊息記錄選擇，且 `scripts/ci-changed-paths.mjs` 能讓該路徑的變動觸發 `compose` job，不能時一併調整並補其既有測試）；override 只把後端的 `command` 換成映像內的 uvicorn 跑該檔，**不放進預設編排、不進映像**。ASGI 檔對任何路徑（含 `/api/v1/health`，讓後端 healthcheck 通過、`up --wait` 成功）都回 `200` 與含 `client`、`scheme` 的 JSON。再在 `ci.yml` 的 `compose` job 於「Stop the Lite tier」（既有的 `docker compose down -v`）之後、「Start the production tier」之前，加一個自成週期的步驟組：`docker compose -f docker-compose.yml -f <override> up --build --wait --wait-timeout 300` → 對 `http://localhost:8080/api/v1/<探針路徑>`（Nginx 只轉發 `/api/v1/`）送一般請求，以及帶 `X-Forwarded-For: 6.6.6.6`、`X-Forwarded-For: 9.9.9.9, 8.8.8.8`、`X-Forwarded-Proto: https` 的請求，只做否定斷言（回報位址是合法 IP、不是 `frontend` 的固定位址、不是偽造值，協定為 `http`；回報位址可能是 `ip_range` 的 gateway，即其第一個位址如 `.128`，不得假設是 `.1`）→ `docker compose -f docker-compose.yml -f <override> down -v`（失敗時既有的 logs 與清理步驟仍須涵蓋 override）。**不得**對正在跑的 Lite 層再以 override 重跑 `up`（只會重建 `backend`，Nginx 保留舊位址而 502，design D4）。**先證明會失敗**：在本機以 override 對「未設定信任」的後端（`FORWARDED_ALLOW_IPS` 改成不含 `frontend` 的值）執行，確認斷言以「回報位址等於 `frontend` 位址」失敗；再對 3.2 的設定通過 [@backend-developer]
- [x] 4.2 本組收尾：在本機以 override 實際 `up`、送請求、`down -v`，三種請求的回報與斷言記在提交訊息；確認 override 與回報檔不在 `backend/` 映像的建置內容、不在預設編排；`pnpm format:check` 以 0 結束 [@backend-developer]

## 5. 文件（5.1 至 5.5 可平行）

本組在第 1 至 4 組落地後撰寫，只寫已成立的內容並引用實際落地的位址常數；5.1 至 5.5 改不同的檔案，可平行，完成後由 5.6 交叉核對並整組提交一次，建議訊息 `docs: document trusted proxy client ip handling (#566)`。

- [x] 5.1 依 design D2（clarification T2、Q10；specs `container-runtime` MODIFIED「設定範例檔列出所有設定且不含 secret」），在 `.env.example` 加 `FORWARDED_ALLOW_IPS`：說明放在代理後面才設、直接暴露時不要設、不得為 `*` 或涵蓋全部位址的網段，並說明子網段與位址常數的所在與重疊時怎麼改（兩層與此變數一起改）；`FORWARDED_ALLOW_IPS` **必須保持註解狀態**（比照 `.env.example:44` 的 `# LOG_LEVEL=INFO`），因為 `scripts/dev.mjs` 會把根目錄 `.env` 載入 `pnpm run dev`，未註解的值會破壞 Q10（沒有 Nginx 時只信任 loopback）；並說明：兩層共用同一子網段，**不可同時運行，切換前先 `docker compose down`**；檢查擋不住的兩種寫法（以 `command` 覆寫帶 `--forwarded-allow-ips '*'`、`0.0.0.0/1,128.0.0.0/1`）不得使用；不含任何未註解的 `*` [@technical-writer]
- [x] 5.2 依 design D2、D4（clarification Q5、Q11、Q10），改 `docs/development/architecture.mdx` §部署與維運：Nginx 後面的信任模型（只信任 `frontend` 的固定位址、右到左取值、沒有 Nginx 時只信任 loopback），並寫「兩層不可同時運行；切換前先 `down`」、檢查擋不住的兩種寫法（`command` 覆寫旗標、`0.0.0.0/1,128.0.0.0/1`），以及已知限制三項（TLS 邊緣之後 scheme 恆為 `http`、Cloudflare 在前面取到邊緣位址、發布埠來源位址依平台而異），歸到 ADR-008 尚未決定的 Cloudflare TLS 模式，不另開 issue；章節編號與既有的決策紀錄慣例依該檔現況 [@technical-writer]
- [x] 5.3 依 design D6，改 `docs/development/workflow/local-development.mdx` 的環境變數表：加 `FORWARDED_ALLOW_IPS`（只有編排檔傳入、本機 `pnpm run dev` 不需設定、預設 loopback only） [@technical-writer]
- [x] 5.4 依 design D6（決議 D；system-design §常駐文件異動），改 `docs/diagrams/architecture/backend-modules.mdx`：後端基礎建設 §設定新增 `FORWARDED_ALLOW_IPS` 一列（API 層、非必填、預設 `127.0.0.1,::1`、規則與只做驗證的說明）、§請求管線加註 uvicorn 的 `ProxyHeadersMiddleware` 在 app 的五個中介層之外且 `scope["client"]`、`scope["scheme"]` 進入第一個中介層前已改寫、已知限制刪除「信任反向代理的來源 IP」那一列並改記 Cloudflare 或其他邊緣代理與 TLS 邊緣後的 scheme；該檔若有決策紀錄表，加一列註明 #566 [@technical-writer]
- [x] 5.5 依 design D5（clarification Q7），改 `frontend/nginx.conf` 第 27 至 30 行的註解：把「belongs to #566」改成已決定的內容（後端信任 Nginx 的 `X-Forwarded-For` 與 `X-Forwarded-Proto`，協定在 TLS 邊緣之後仍是 `http`），英文撰寫；不改任何指令。完成判定：`git diff -- frontend/nginx.conf` 只含註解行，`scripts/check-security-headers.sh` 不需變動 [@technical-writer]
- [x] 5.6 本組收尾：先交叉核對 5.1 至 5.4 寫入的位址常數、變數名、預設值與 `docker-compose.yml`、`docker-compose.prod.yml` 實際值逐字相同，已知限制三項在 5.2 與 5.4 的說法一致，`backend-modules.mdx` 沒有仍指向 #566 為「待建置」的列。再在 repo 根目錄執行 `node scripts/check-specs.mjs docs`、`node scripts/check-citations.mjs --strict`、`pnpm check:er`（本 change 不動資料模型，應照常通過）、`pnpm format:check`，全部以 0 結束；不執行 NoteCraft 建置（design D7）；`git status --porcelain` 只含本組的檔案 [@technical-writer]

## Workflow follow-up

- 全部 task 完成且工作區乾淨後，交 code-reviewer 審查：特別核對 `backend/Dockerfile` 沒有 diff；兩份編排檔的子網段、`ip_range`、`frontend` 位址與預設 `FORWARDED_ALLOW_IPS` 相同且預設不是 `*`；P2 的 override 與回報檔不在映像與預設編排內；探針模組只在 `backend/tests/`；`Settings` 的錯誤訊息不印值。修正由實作角色另開 commit。
- PR 描述註明：issue 使用情境的「存取 log 拿到錯的 IP」與 `server-logging`（不記來源 IP）不符，本 change 依 Q6 維持 `server-logging` 不動。
- acceptance-verifier 對照 `specs/trusted-proxy-client-ip`、`specs/runtime-config`、`specs/container-runtime` 的每個 Scenario 驗收，報告寫在本 change 目錄的 `acceptance.md`。人工驗收步驟：`docker compose up --build --wait --wait-timeout 300` 後以 override 送一般與偽造請求，確認回報的位址不是 `frontend` 位址也不是偽造值；以 `FORWARDED_ALLOW_IPS=*` 啟動後端確認拒絕且訊息不含值。本 change 沒有畫面，沒有登入角色。
- 驗收通過後由 ops 在合併前執行 `/opsx:archive`：把 `specs/trusted-proxy-client-ip` 同步為新的主規格（Purpose 不留 TBD），`specs/runtime-config` 與 `specs/container-runtime` 的 ADDED 與 MODIFIED delta 同步進主規格，歸檔改動進同一張 PR；再依合併條件（CI 每個 job completed 且 success、審查無阻斷意見、PR 可合併）合併。
