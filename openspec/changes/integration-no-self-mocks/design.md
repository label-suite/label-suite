# Design

## Context

動機見 proposal.md §Why；要擋哪些寫法、用什麼機制、例外怎麼記的全部決議見 `clarification.md` §待釐清項目（Q1–Q10、N1、N4–N6，2026-11-25），本文件不重述理由。機制的組成、已驗證的規則本文與命中數見 system-design §先決發現、§機制總覽、§規則集與 Q1 選項的對照、§規則本文（已驗證）、§例外的記法（Q7）、§「harness 與 production 共用同一個 app 組裝函式」（Q6）、§持久的失敗樣本；下文只寫那幾節沒有定下、實作前必須定下的決策，以及與既有 capability 的關係。

現況限制（`origin/main`，2026-11-25）：

- `.semgrep/` 只有 `label-suite.yml`（兩條專案禁令）、`tests/label-suite.py`、`tests/label-suite.ts` 與指向 `../label-suite.yml` 的符號連結 `tests/label-suite.yml`。`semgrep --test .semgrep/` 依檔名主檔名把樣本配對到規則檔。
- `.github/workflows/ci.yml` 的 `semgrep` job 用 `semgrep/semgrep:1.186.0` 映像，兩步：`semgrep --test .semgrep/`、`semgrep scan --error --config .semgrep/label-suite.yml backend/ frontend/ e2e/`。`scripts/tests/ci-workflow.test.mjs` 的「C11: semgrep」以 `requireStep`（取第一個符合的步驟）斷言樣本驗證排在掃描之前、掃描只載入 `label-suite.yml`。
- `scripts/check.mjs` 的 `OPTIONAL_STEPS["--with-semgrep"]` 是一步 `semgrep`，含上面兩個指令；`scripts/tests/check.test.mjs` 斷言預設的 12 步與加旗標後最後 4 個指令。
- `backend/tests/conftest.py` 的 `app` fixture 是 `create_app(make_test_settings(tmp_path))` 再以 `create_api_router()` 掛上 `tests.probe.probe_router`；`probe_router` 本身沒有前綴，路徑以 `/api/v1` 為前綴出現在文件裡。
- `backend/tests/` 目前沒有任何 `nosem` 標記；integration 測試以 `pytestmark = pytest.mark.integration` 標記。

## Goals / Non-Goals

**Goals:**

- 檢查範圍內出現被禁的寫法時，CI 的 `semgrep` job 與 `pnpm run check --with-semgrep` 都失敗（specs `test-boundary-checks`、`workspace-commands`）。
- harness 與 production 的組裝差異由常駐測試擋下，測試本身以突變案例證明有效。
- 例外只能以帶規則 id 與條號理由的行內標記放行，且有測試強制。
- 新規則集中在獨立檔案，既有掃描與既有規則的行為不變。

**Non-Goals:**

- 前端（Q5）；`e2e/`；環境變數與工作目錄的替換（Q1）。
- 處理 S1 會暴露的 4 筆既有 secret 命中（N1，範圍外，只回報）。
- 擋下 N5 的三種繞法；把網路邊界改成明列清單（Q2，接上外部服務時另行處理）。
- 不改 `backend/app/`、`backend/tests/integration/test_export_openapi.py`、`.semgrep/label-suite.yml`，不新增 `.semgrepignore`，不改 `docs/specs/`、`docs/specs/00-prd.mdx`、`design/prototype/`。

## Decisions

### D1 capability 歸屬：新增 `test-boundary-checks`，`workspace-commands` 寫 MODIFIED delta（Q9；clarification P2）

- **`test-boundary-checks`（新增）**：被擋的寫法、允許的邊界、`export_openapi` 常數放行、檢查範圍、CI 執行、不另建 app、組裝比對、例外記法、常駐樣本、規則文件寫回。
- **`workspace-commands` 寫 MODIFIED delta**：`pnpm run check` 的步驟屬這個 capability。既有「check 依固定順序執行與 CI 相同的自查」只描述 `--with-semgrep` 會跑原始碼安全掃描；本 change 讓 `--with-semgrep` 多一步（D7），所以把該 Requirement 整段複製到 delta，在描述加一句、修改「預設不跑 e2e 與安全掃描」的 THEN，並新增兩個 Scenario。
- **`ci-quality-gates` 不寫 delta**：新檢查是既有 `semgrep` job 的一步，不是新 job。「前後端檢查每張 PR 都執行」已涵蓋該 job 每張 PR 執行；「CI 檢查只有讀取權限且不使用 secret」針對新增的 job，本 change 不新增 job；兩支新 pytest 落在既有的「後端測試在兩種資料庫各跑一輪」。這幾條文字不改仍然成立。CI 新步驟的行為由 `test-boundary-checks`「檢查在 CI 每張 PR 執行且違規即失敗」規定。
- **`security-scanning` 不寫 delta**（clarification P2、N1 採 S2）：「專案禁令掃描違規即失敗」與其 Scenario「掃描只回報兩條專案規則」規定的是**專案禁令掃描**那一步的規則集與範圍；本 change 不改那一步的指令（`test-boundary-checks` 以 Scenario「既有專案禁令掃描不變」守住），新檢查以另一個規則檔、另一個步驟執行。「專案禁令規則附回歸樣本」的 `semgrep --test .semgrep/` 會一併驗證新樣本，與其文字相容。

### D2 規則檔與規則集（Q1、Q3、Q6；system-design §規則集與 Q1 選項的對照、§規則本文（已驗證））

新檔 `.semgrep/test-boundaries.yml`，五條規則，`severity: ERROR`、`languages: [python]`，每條帶相同的 `paths.include`（D3）：

| 規則 id                                 | 依據   | 規則本文                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :-------------------------------------- | :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label-suite-test-self-mock-string`     | Q1     | 照 system-design §規則本文                                                                                                                                                                                                                                                                                                                                                                                                        |
| `label-suite-test-self-mock-object`     | Q1、Q3 | 照 system-design §規則本文，含 `DEFAULT_OUTPUT`、`DOCS_COPY_OUTPUT` 兩條 `pattern-not`；該節的接收者正規式已涵蓋內建 `setattr`（沒有接收者時也符合）                                                                                                                                                                                                                                                                              |
| `label-suite-test-dependency-overrides` | Q1     | 照 system-design §規則本文                                                                                                                                                                                                                                                                                                                                                                                                        |
| `label-suite-test-mock-objects`         | Q1-D   | 本節定下（system-design 寫「實作時依上表補上」）：`pattern-either` 列 `MagicMock(...)`、`AsyncMock(...)`、`Mock(...)`、`create_autospec(...)`、`$X.MagicMock(...)`、`$X.AsyncMock(...)`、`$X.Mock(...)`、`$X.create_autospec(...)`、`import unittest.mock`、`from unittest import mock`、`from unittest.mock import $N`（含多名稱與別名）。`$X.` 那幾條涵蓋 `mock.MagicMock()`、`unittest.mock.MagicMock()`、`mocker.MagicMock()` |
| `label-suite-test-own-app-factory`      | Q6 B   | 照 system-design §規則本文                                                                                                                                                                                                                                                                                                                                                                                                        |

`any-patch`（Q1-C）與 `app-fixture-uses-create-app`（Q6 B 的輔助）不放進規則檔。每條的 `message` 以英文寫明違反 T4 或 T6、應改替換外部邊界，以及例外記法 `# nosemgrep: <rule-id> -- T4|T6 <reason>`。檔案頂端註解指向 testing-agent-rules T4、T6、issue #562 與 clarification Q1–Q3、Q6、Q7。YAML 要通過 `pnpm format:check`（Prettier 會格式化 `.semgrep/*.yml`），所以寫完以 `pnpm exec prettier --write` 格式化再驗證。

替代方案：把規則加進 `label-suite.yml`。不採用，理由見 system-design §機制總覽「為什麼獨立一個規則檔」：新規則需要不同的掃描旗標（D3），而且 `label-suite.yml` 的 Scenario 規定專案禁令掃描只有兩條規則。

### D3 掃描範圍：S2 加 `paths.include`，靠釘住的映像保證實驗旗標（Q2、Q4、N1；system-design §先決發現）

指令（CI 與本機逐字相同）：

```text
semgrep scan --error --x-ignore-semgrepignore-files --config .semgrep/test-boundaries.yml backend/
```

**範圍的精確定義**：Semgrep 從 `backend/` 走訪後的候選檔，與規則 `paths.include` 的四個錨定樣式 `/backend/tests/integration/`、`/backend/tests/conftest.py`、`/backend/tests/probe.py`、`/backend/tests/factories/` 取交集，只看 Python 檔。`--x-ignore-semgrepignore-files` 只關掉 Semgrep 內建的預設忽略（其中含 `tests/`），**不關掉 `.gitignore`**：2026-11-25 以 1.186.0 映像在本 worktree 實測，`backend/.venv/` 存在時掃描清單仍為 12 個檔（`conftest.py`、`probe.py` 與 `tests/integration/` 的 10 個檔），沒有任何 `.venv` 下的檔案；`backend/tests/unit/` 不在交集內。`factories/` 今天不存在，不報錯（system-design 已驗證）。

**實驗旗標的保證**：`--x-` 開頭的旗標沒有相容承諾，它的行為只由 CI 釘住的 `semgrep/semgrep:1.186.0` 保證。升級映像版本時，必須在同一個 PR 重跑 D9 的範圍證明（暫時放違規、確認被擋）與 `semgrep --test .semgrep/`；規則文件 T4 的檢查方式寫明這一點（D10）。

**N2：範圍只能一次性證明**。`semgrep --test` 不套用 `paths`（system-design N2 已驗證），常駐樣本只證明樣式。範圍以 tasks 1.4 與驗收時的「暫時放違規再還原」證明，不做持久的範圍證明（Q8、N2）。

替代方案：S1（根目錄新增 `.semgrepignore`），會讓既有 secret 規則多出 4 筆範圍外命中，未採用（N1）。

### D4 常駐樣本（Q8、N5；system-design §持久的失敗樣本）

新增 `.semgrep/tests/test-boundaries.py` 與符號連結 `.semgrep/tests/test-boundaries.yml -> ../test-boundaries.yml`（沿用 `label-suite.yml` 的配對方式；沒有這個連結 `semgrep --test` 找不到規則）。樣本內容：

- 每條規則至少一個 `# ruleid:` 行，涵蓋 specs `test-boundary-checks` 各 Scenario 列出的寫法；
- `# ok:` 行涵蓋 specs 中「不擋」的寫法：`application.x`、`sys.stderr`（物件與字串）、`httpx.AsyncClient.send`、`setenv`、`delenv`、`chdir`、`@router.patch("/items")`、只讀取 `dependency_overrides`、`create_app(...)` 與 `include_router(...)`、`export_openapi` 的兩個輸出常數；
- 例外記法：同一行有 id 與理由（`ok`）、上一行有 id 與理由（`ok`）、只指名別的規則（`ruleid`）；
- N5 的三種繞法各一行，**不加任何標註**，上方以一般註解寫明「已知擋不住（N5），日後若被命中，`--test` 會報 incorrect lines，改成 `ruleid`」。

樣本是合成程式碼，不含答案資料。`.semgrep/` 不在任何掃描指令的目標內，違規樣本不會讓掃描失敗。不建 `.semgrep/tests/test-boundaries.ts`（Q5）。

### D5 組裝比對測試（Q6 C、N6；system-design §「harness 與 production 共用同一個 app 組裝函式」）

新檔 `backend/tests/integration/test_harness_parity.py`，`pytestmark = pytest.mark.integration`：

- **兩邊怎麼取得**：production 為 `create_app(make_test_settings(tmp_path))`；harness 直接用 `conftest.py` 的 `app` fixture（同一個 `tmp_path`、同一份設定），這樣比的是測試實際使用的 harness，而不是另外照抄一份。
- **允許多出的路徑**：`{API_V1_PREFIX + route.path for route in probe_router.routes if isinstance(route, APIRoute)}`，`API_V1_PREFIX` 取自 `app.main`；不寫死探針路徑清單，探針新增路由時不必改測試。
- **比對函式** `assert_same_assembly(production, harness, allowed_extra_paths)`：(1) `[m.cls for m in user_middleware]` 兩邊相等（含順序），不符時訊息列出兩邊清單；(2) `set(exception_handlers)` 相等，不符時列出差集；(3) `production.openapi()["paths"]` 的每個鍵都在 harness 中且值相等，缺少或不同時列出路徑；harness 多出的鍵必須是 allowed 的子集，否則列出多出的路徑。不比 `app.routes`（system-design 已驗證會假陰性）。
- **突變案例**（Q8 對應，證明比對有效，每案各以 `pytest.raises(AssertionError, match=…)` 斷言訊息）：harness 的 `user_middleware.pop()` 後失敗；交換 harness 兩個中介層的順序後失敗；刪除 harness 一個 `exception_handlers` 鍵後失敗；把參數對調（以 harness 當 production、另一個 `create_app` 當 harness）使探針路徑成為「缺少」而失敗；harness 再以 `APIRouter()` 掛一條 `/api/v1/not-a-probe` 後失敗。突變後把 `middleware_stack` 設為 `None`，不啟動 app。
- **不跑 lifespan、不連資料庫**（N6），所以 SQLite 與 PostgreSQL 兩輪結果相同。
- 檔案本身在 Semgrep 檢查範圍內：不得呼叫 `FastAPI(`、不得用 `setattr` 系列改 `app` 的東西，突變一律以 list／dict 操作與 `include_router` 完成。

### D6 例外標記檢查（Q7、N3；system-design §例外的記法（Q7））

新檔 `backend/tests/unit/test_semgrep_exemptions.py`，只用 `re` 與 `pathlib`：

- **走訪範圍**：`backend/tests/` 底下任一層的 `*.py`（以 `Path.rglob("*.py")` 取得，略過路徑含 `__pycache__` 的項目）。比 Semgrep 檢查範圍寬，順便擋住在 `tests/unit/` 等處放無意義的標記（system-design §例外的記法 末段）。
- **偵測**：逐行比對 `#\s*nosem`（不分大小寫）；2026-11-25 以 1.186.0 映像實測：Semgrep 除了 `# nosemgrep` 也認得較短的 `# nosem`，而且同一行字串常值裡的 `"# nosemgrep"` 同樣會抑制該行的發現；所以偵測逐行比對原始文字，字串裡的寫法也算，不只看註解 token。
- **合格格式**：`#\s*nosemgrep:\s*<id>(\s*,\s*<id>)*\s+--\s+<reason>`，其中每個 `<id>` 符合 `label-suite-test-[a-z0-9-]+`，`<reason>` 非空且含獨立的 `T4` 或 `T6`。其他拼法（含 `nosem`、裸 `nosemgrep`、缺 `--`、理由沒有條號）一律判為不合格，訊息列出 `相對路徑:行號`、該行內容與要求的格式。
- **測試案例**：以 `tmp_path` 造樣本檔，驗證：裸 `# nosemgrep`、`# nosem`、`# NOSEMGREP`、只有 id 沒有 `--`、理由沒有 T4／T6、id 不是 `label-suite-test-*` 各自不合格；同一行合格、多個 id 合格；字串裡的 `"# nosemgrep"` 也被偵測。另一案對真實 `backend/tests/` 斷言沒有不合格的標記。
- **自身不觸發**：本檔的 docstring 與樣本不得含 `#` 緊接 `nosem` 的字面，樣本以字串拼接產生（例如 `"#" + " nosem" + "grep"`）；本檔在走訪範圍內，不排除自己，等於由自己證明。

替代方案：在 Semgrep 內以 `generic` 規則強制理由，被裸 `nosemgrep` 抑制，不可行（system-design 已驗證）。

### D7 本機自查：`--with-semgrep` 多一步（Q4；specs `workspace-commands`）

`OPTIONAL_STEPS["--with-semgrep"]` 由一步改為兩步：既有的 `{ id: "semgrep", name: "Semgrep", … }` 不變，其後新增 `{ id: "semgrep-test-boundaries", name: "Semgrep test boundaries", commands: [<D3 的指令>] }`。預設 12 步不變；加旗標時排在最後，`semgrep --test .semgrep/` 已在前一步先跑。

為什麼是新的一步而不是在既有步驟多一個指令（system-design §機制總覽 寫的是「多一個指令」）：clarification Q4 與「交給後續產出」寫的是「`scripts/check.mjs` 加對應的一步」並要求更新步驟數；獨立一步也讓輸出的 `PASS`／`FAIL` 行直接指出是哪一種檢查。兩種做法跑的指令相同，以 clarification 為準。

`scripts/tests/check.test.mjs`：斷言 `OPTIONAL_STEPS["--with-semgrep"]` 的 `id` 依序為 `semgrep`、`semgrep-test-boundaries`；加 `--with-e2e --with-semgrep` 時最後 5 個指令依序為 e2e 兩個、`semgrep --test .semgrep/`、既有掃描、新掃描；輸出含 `PASS Semgrep test boundaries` 與 `all 15 steps done`；新指令回傳非 0 時輸出 `FAIL Semgrep test boundaries` 且結束碼非 0。預設 12 步那一案不改。

### D8 CI：`semgrep` job 多一步（Q4、N1；specs `test-boundary-checks`）

在 `semgrep` job 既有的「Scan for the project rules」**之後**加一步 `name: Scan the tests for self-mocks (T4, T6)`，`run` 為 D3 的指令；上方註解寫明 S2、實驗旗標由映像版本保證、`label-suite.yml` 的掃描不動。放在最後是為了讓「C11: semgrep」以 `requireStep` 找第一個 `semgrep scan --error` 時仍拿到既有掃描，既有斷言不改。

`scripts/tests/ci-workflow.test.mjs` 的「C11: semgrep」加一個測試：job 中恰有一步的 `run` 含 `--config .semgrep/test-boundaries.yml`，該步含 `--error`、`--x-ignore-semgrepignore-files`、目標為 `backend/`、不含 `label-suite.yml`，且排在 `semgrep --test .semgrep/` 之後；既有掃描那一步不含 `test-boundaries.yml`。

### D9 違規先失敗再提交（issue 工作項 5；Q8、N2）

每一組都先對刻意違規跑出失敗再提交，失敗輸出摘要記在該組的提交訊息：規則組先寫樣本、在規則尚未寫入時跑 `semgrep --test .semgrep/` 得到 missed lines；範圍以暫時在 `conftest.py`、`probe.py`、`tests/integration/` 的檔案各放一行違規、以 D3 指令確認被擋再還原；兩支 pytest 先寫測試再實作，並以暫時改 `conftest.py` 的 `app` fixture、暫時放一個裸標記確認真實檔案的案例會失敗。驗收時 acceptance-verifier 再做一次範圍證明（N2）。

### D10 規則文件（Q5、Q9、N5；system-design §常駐文件異動）

- `testing-agent-rules.mdx` **T4**：適用路徑改為 `backend/tests/integration/**`、`backend/tests/conftest.py`、`backend/tests/probe.py`、`backend/tests/factories/**`；例外格補「探針路由只准加、不准減」與「`export_openapi` 的兩個輸出路徑常數視為檔案系統邊界」；檢查方式寫 CI `semgrep` job 的 D3 指令、本機 `pnpm run check --with-semgrep`、`tests/integration/test_harness_parity.py`、`tests/unit/test_semgrep_exemptions.py`、例外記法與「升級 Semgrep 映像時重驗範圍」；「harness 與 production 同構」不再標「待建置」。
- **T6**：檢查方式寫後端由同一個指令檢查（替換對象不是 `app` 即視為邊界，接上外部服務時改成明列清單）；N5 三種擋不住的寫法；前端未納入的原因（integration 與 unit 同目錄同副檔名），前端部分維持「**待建置**」。不另開 issue（Q5）。
- 文首狀態段把 T6 的後端部分列入在 CI 跑的條文；§各條規範的來源 T4、T6 兩列補 issue #562、Epic #560 與 clarification；§決策紀錄加一列 2026-11-25（#562）。T9 表不加列（Q9）。
- `agent-rules.mdx` 總覽段「在 CI 跑的」清單把 testing-agent-rules 的條文改為含 T6 的一部分；§決策紀錄加一列。
- 常駐文件（`docs/diagrams/architecture/*`）不動，理由見 system-design §常駐文件異動。

### D11 不在 worktree 執行 NoteCraft build（偏離 `openspec/config.yaml` operations.apply）

`openspec/config.yaml` operations.apply 要求動到 `docs/` 的群組提交前執行 `pnpm exec notecraftapp build docs --rebuild`。本 change 明示偏離這一項：第 3 組在 worktree 內不執行 NoteCraft build，理由是從 worktree 建置會污染主倉庫共用的 `~/.notecraft` 建置快取，worktree 刪除後主倉庫的建置會持續失敗（與 #561 design D10 相同）。替代的檢查：`node scripts/check-specs.mjs docs`、`node scripts/check-citations.mjs --strict`、`pnpm format:check`；渲染驗證由 CI 的 `docs-site` job 負責，該 job 失敗即視同本機建置失敗。

另一項環境限制：本機沒有安裝 `semgrep` 執行檔，`pnpm run check --with-semgrep` 在本機無法直接跑。tasks 以 `docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep:1.186.0 <CI 的指令>` 在 repo 根目錄執行與 CI 逐字相同的指令代替；`check.mjs` 的行為由 `scripts/tests/check.test.mjs` 以假的 runner 驗證。

### D12 與 #563 的衝突處理

#563 可能同樣改 `.github/workflows/ci.yml`、`scripts/check.mjs`、`scripts/tests/check.test.mjs`、`backend/pyproject.toml` 與 testing-agent-rules 文首狀態段、`agent-rules.mdx` 總覽。兩張互不依賴，不設 blocked-by。本 change 把改動集中：CI 只在 `semgrep` job 尾端加一步，`check.mjs` 只在 `OPTIONAL_STEPS["--with-semgrep"]` 尾端加一步，不碰 `STEPS`，不改 `pyproject.toml`。**後合併者在自己的分支 merge `origin/main`**（不 rebase、不 force push），解衝突時兩邊新增的步驟、斷言與狀態段文字都保留，再重跑受影響群組的收尾檢查後推上。

## Risks / Trade-offs

- [`--x-ignore-semgrepignore-files` 是實驗旗標，Semgrep 升級可能改變或移除] → 映像釘在 1.186.0；升級時重驗範圍（D3），T4 寫明。
- [N5 三種繞法擋不住] → 寫進 T6 與樣本（D4），靠審查；日後要擋改用 pytest AST（Q4-B），不在本 change。
- [N4：名為 `app` 的 fixture 的屬性替換會被判違規] → 誤報方向安全，真遇到時用例外記法（specs 已寫成 Scenario）。
- [N2：範圍沒有常駐證明，有人改窄 `paths.include` 時樣本仍通過] → 範圍在 tasks 與驗收各做一次性證明；`paths.include` 的四個樣式寫在 T4 的適用路徑，改規則時審查對照。
- [N6：比對測試不跑 lifespan，差異藏在 lifespan 時比不到] → lifespan 只由 `create_app` 掛上，另建 app 已被 `own-app-factory` 擋下；lifespan 行為由既有 integration 測試涵蓋。
- [`mock-objects` 規則會連外部邊界用的 `unittest.mock` 一起擋] → Q1-D 的決議即如此；外部邊界改用 `monkeypatch.setattr` 替換非 `app` 目標（specs「外部邊界與行程環境的替換不受限」）。
- [`security-scanning` 的「掃描只回報兩條專案規則」被讀成整個 `semgrep` job] → D1 說明該 Requirement 指專案禁令掃描那一步；`test-boundary-checks` 以 Scenario 守住那一步不變。若 design-reviewer 或維護者認為需要明文，改為在 `security-scanning` 補 MODIFIED delta，不影響實作。
- [新掃描讓 `semgrep` job 多約 20–30 秒] → 本機以映像實測約 24 秒（含映像啟動），不構成阻擋。
- [與 #563 合併衝突] → D12。
- [第 3 組沒有在本機跑 NoteCraft build] → D11；`docs-site` job 必過。

## Migration Plan

沒有資料、API 或畫面的遷移，沒有 Alembic migration。上線就是合併本 change 的 PR；合併當下 `backend/` 在檢查範圍內零違規（`export_openapi` 的 4 處由 D2 放行），`backend/tests/` 沒有 `nosem` 標記，比對測試在現有 harness 上通過，所以 main 不會因合併而變紅。

回滾：revert 本 change 的實作 commit（規則與接線組、後端測試組、文件組各一個）。三組可單獨 revert：只 revert 規則組時，CI 與 `check.mjs` 的新步驟與規則檔一起回去；後端測試組不依賴規則組也能單獨存在。沒有需要清理的狀態。

## Open Questions

無。所有會影響 specs、做法或拆工的問題已由 clarification Q1–Q10、N1、N4–N6 決議；D2 的 `mock-objects` 樣式、D5 的允許路徑算法、D6 的偵測格式與 D7 的「一步」是本文件依決議定下的技術選擇，D11 是對 operations.apply 單一檢查的偏離，都不改變任何決議。
