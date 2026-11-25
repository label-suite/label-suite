# Tasks

本 change 沒有 schema 變更、沒有 API 變更、沒有畫面變更（`api-contract.md`、`ui-design.md`、system-design §資料模型異動），所以沒有 `[@dba]` task，也不重新產生 `openapi.json` 與前端型別；動到 `backend/` 的群組以後端契約漂移指令確認「沒有差異」收尾。JavaScript 指令在 repo 根目錄以 `pnpm` 執行，Python 在 `backend/` 以 `uv`；不得出現 npm install 或 pip install，本 change 不新增任何相依套件（`grimp` 已是 `import-linter` 的相依）。

**提交規則**：每個群組完成後提交一次，訊息依 AGENTS.md §Commits（`<type>: <subject> (#563)`、body 每點以粗體動詞開頭、動詞後不加冒號），結尾**恰好一個** `Co-Authored-By` trailer 標明模型。commit 被 hook 擋下時修正後重新 `git commit`，**不得** `--amend`；push 前以 `git log origin/main..HEAD` 確認只有本分支的 commit。

**先證明檢查會失敗**（issue #563 工作項 5、clarification §交給後續產出）：每個 `[@backend-developer]` 群組都先寫樣本與測試，在契約或實作還沒到位時跑出失敗，再補契約或實作跑到通過；各組的「故意弄壞再還原」以暫時修改做，還原後 `git diff` 只剩本 task 的改動，指令與失敗輸出摘要記在該組的提交訊息。

**測試檔大小**：新增與修改的 Python 測試檔每個不超過 400 行（B11，由 `backend/tests/unit/test_size_limits.py` 檢查），函式也受 B11 的 ruff 上限約束。

**不在 worktree 執行 NoteCraft 建置**：對 `openspec/config.yaml` operations.apply 的明示偏離，理由與替代檢查見 design D10。

順序：第 1 組先抽出共用 helper 並把「4 kept」換成契約數與名稱集合（行為不變），之後每個新增契約的群組同步擴充 `EXPECTED_CONTRACTS`，所以每組單獨提交都能通過 CI；第 2 組的 `ENTRY_THIRD_PARTY` 供第 3 組使用；第 6 組在全部後端工作之後收尾；第 7 組文件只寫已成立的檢查，排在最後。

## 1. 共用樣本樹 helper 與契約名稱集合

本組完成後，兩個測試檔可共用樣本樹 helper，`test_layer_boundaries.py` 不再寫死契約數，改比對契約數與契約名稱集合；契約仍是現有四條，行為不變。建議訊息 `test: compare import contracts by count and name (#563)`。

- [x] 1.1 依 design D7（clarification Q9），以 TDD 新增 `backend/tests/unit/import_tree.py`，把 `write`、`build_tree`、`run_lint_imports`、`append`、`load_contracts`、`PYPROJECT`、`BACKEND_DIR` 從 `test_layer_boundaries.py` 抽出（模組 docstring 指向 B1、#563、clarification Q9）；`test_layer_boundaries.py` 改為 `from tests.unit.import_tree import …`。`build_tree` 另寫 `app/scripts/__init__.py`（原樣本樹沒有 `app/scripts`，而入口契約的 `source_modules` 含 `app.scripts`，缺它則 `lint-imports` 以 `Module 'app.scripts' does not exist.` 結束碼 1；原則：樣本樹含入口契約 `source_modules` 的每個頂層套件）。完成判定：抽出前後 `cd backend && uv run pytest tests/unit/test_layer_boundaries.py` 的通過數相同，檔案沒有 `test_` 前綴、不被收集 [@backend-developer]
- [x] 1.2 依 design D7（specs「契約集合以數量與名稱比對，並由常駐違規樣本證明有效」的前三個 Scenario），以 TDD 把 `assert "4 kept, 0 broken" in result.stdout` 換成 `f"{len(load_contracts())} kept, 0 broken"`，並加 `EXPECTED_CONTRACTS`（現有四個名稱）與純函式 `contract_name_diff(contracts, expected)`（回傳缺少與多出的名稱）。**先寫測試並跑出失敗**：以記憶體中的假契約清單寫三個案例，分別是刪一條且同時加一條（總數不變）、只刪一條、只改名，各自斷言 `contract_name_diff` 回傳預期的差異，函式先只 `raise NotImplementedError`，`cd backend && uv run pytest tests/unit/test_layer_boundaries.py` 先看到失敗，實作後通過；另加一個斷言真實契約名稱集合等於 `EXPECTED_CONTRACTS` 的測試。故意弄壞：暫時把 `pyproject.toml` 某條契約改名，確認該測試失敗並點名缺少與多出的名稱，還原 [@backend-developer]
- [x] 1.3 本組收尾：`cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy --strict app && uv run lint-imports && uv run pytest` 全部以 0 結束，回報 pytest 摘要的 passed 與 skipped 數；`pnpm format:check` 以 0 結束；`git status --porcelain` 只含本組的檔案 [@backend-developer]

## 2. 入口 forbidden 契約與頂層套件守門測試

本組完成後，`pyproject.toml` 有三條入口 `forbidden` 契約，`test_entry_contracts.py` 以常駐樣本證明每條會擋、入口與間接使用會放行，守門測試擋下未歸類的頂層套件。建議訊息 `feat: enforce single entries for mail, oidc and http clients (#563)`。

- [x] 2.1 依 design D1、D3（clarification Q1、Q3；specs「寄信套件只能經寄信入口使用」「Google OIDC 套件只能經 OIDC 入口使用」「對外 HTTP 客戶端套件只能經 HTTP 入口使用」「入口與間接使用不算違規」），以 TDD 新增 `backend/tests/unit/test_entry_contracts.py`（模組 docstring 指向 B12、#563、clarification Q1、Q3）與三條契約。**先寫樣本並跑出失敗**：用 `import_tree` 的 `build_tree`／`append` 寫案例，業務模組 service import `resend`、`smtplib`、`aiosmtplib`、`authlib`、`httpx`、`requests`、`aiohttp`、`urllib3` 各一（斷言以非 0 結束，且輸出含對應契約名稱加 `BROKEN` 與 `app.modules.<m>.service -> <pkg>`，不只檢查結束碼）、`app.core` 與 `app.main` import `httpx`、業務模組 import 標準庫 `urllib.parse` 通過、假想入口套件 `app/integrations/mail.py`（樣本專用，位置不代表決定）import `resend` 通過、業務模組 import 入口而入口 import `resend` 通過（通過案例斷言結束碼 0 且輸出含 `0 broken`）；契約還沒加時違規案例必須失敗，`cd backend && uv run pytest tests/unit/test_entry_contracts.py` 先看到。再把三條契約（`source_modules = ["app.core", "app.modules", "app.main", "app.scripts"]`、`allow_indirect_imports = true`、禁止清單依 design D1，每條上方註解寫明 L3 與 L4 的理由）加進 `backend/pyproject.toml`，同步 `EXPECTED_CONTRACTS`，跑到通過。`ENTRY_THIRD_PARTY`（鍵為契約名稱字串，值為該入口的第三方套件，三組）與 `ENTRY_TOP_LEVEL_PACKAGES`（空）定義在 `import_tree.py`，供案例與第 3 組使用。故意弄壞：暫時從 `Mail only through its entry` 的 `forbidden_modules` 拿掉 `resend`，確認對應案例失敗並還原 [@backend-developer]
- [x] 2.2 依 design D3（clarification Q3；specs「`app` 底下每個頂層套件都受入口契約檢查」），以 TDD 在 `test_entry_contracts.py` 加守門測試。**先寫案例並跑出失敗**：`unclassified_top_level(app_dir, source_modules, entry_packages)` 先只 `raise NotImplementedError`，案例為：樣本樹新增 `app/stray/__init__.py` 時失敗並點名 `stray`；已登記的入口套件同時出現在某條入口契約的 `source_modules` 時失敗並點名套件與契約；某條入口契約的 `source_modules` 少列 `app.scripts` 時失敗並點名契約與缺少的套件；某條入口契約的 `source_modules` 為 `["app"]` 時通過（D8 (b) 的形狀，不當成漏列）；真實 `app` 通過。實作後跑到通過，並以 `pkgutil.iter_modules` 讀 `app`，與三條入口契約的 `source_modules` 比對。故意弄壞：暫時在 `backend/app/` 新增 `stray/__init__.py`，確認守門測試失敗並點名，刪除該檔還原（`git status` 無殘留） [@backend-developer]
- [x] 2.3 本組收尾：`cd backend && uv run lint-imports` 輸出 `Contracts: 7 kept, 0 broken.`；`uv run ruff check . && uv run ruff format --check . && uv run mypy --strict app && uv run pytest` 以 0 結束，回報 passed 與 skipped 數；`test_entry_contracts.py` 不超過 400 行 [@backend-developer]

## 3. 第三方套件分類測試

本組完成後，`app` 實際 import 的每個第三方套件都必須歸類，入口的套件清單與契約禁止清單由測試比對。建議訊息 `test: classify every third-party import under app (#563)`。

- [x] 3.1 依 design D4（clarification Q4；specs「每個被 import 的第三方套件都已歸類」），以 TDD 新增 `backend/tests/unit/test_dependency_classification.py`（模組 docstring 指向 B12、#563、clarification Q4）。**先寫測試並跑出失敗**：純函式 `unclassified_imports(root: Path, general: set[str], entry_third_party: dict[str, set[str]]) -> list[str]` 先只 `raise NotImplementedError`，案例為：`tmp_path` 樣本樹某檔 `import yaml` 且不在傳入的任何清單時回傳 `['yaml']`（不用 `requests`，它在 HTTP 入口的禁止清單內）、標準庫（`json`、`pathlib`）不回傳、不在任何歸類清單的套件無論是否在宣告相依裡都被回傳、真實 `app` 回傳 `[]`、傳入缺少 `starlette` 的 `general` 時回傳 `['starlette']`（以參數注入清單，不改常數）；`cd backend && uv run pytest tests/unit/test_dependency_classification.py` 先看到失敗。實作以 `grimp.build_graph("app", include_external_packages=True, cache_dir=None)` 扣掉 `sys.stdlib_module_names`；因 `tests/conftest.py` 已 import 真實的 `app`，對樣本樹的分析 MUST 在子行程執行（與 `run_lint_imports` 相同：`cwd=root`、`PYTHONPATH=root`），真樹案例可在行程內執行；不新增 gitignore（grimp 自己寫 `*` 的 `.gitignore`）；`GENERAL_PACKAGES` 初始值以真樹實測輸出為準，跑到通過 [@backend-developer]
- [x] 3.2 依 design D4（clarification Q4；specs 同上的一致性 Scenario），以 TDD 在同一個測試檔加一致性測試：`ENTRY_THIRD_PARTY` 每一組與同名入口契約的 `forbidden_modules` 比對。**先寫案例並跑出失敗**：純函式 `entry_list_diff(entry_third_party, contracts)` 先只 `raise NotImplementedError`，案例為某入口清單多一個套件、少一個套件各自失敗並點名入口與差異，真實設定一致；實作後通過。故意弄壞：暫時在 `pyproject.toml` 某條入口契約的 `forbidden_modules` 多加一個套件，確認一致性測試失敗並點名，還原 [@backend-developer]
- [x] 3.3 本組收尾：`cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy --strict app && uv run lint-imports && uv run pytest` 全部以 0 結束，回報 passed 與 skipped 數；`test_dependency_classification.py` 不超過 400 行 [@backend-developer]

## 4. 跨模組契約：independence 與 router protected

本組完成後，`pyproject.toml` 有 `Modules do not import each other` 與 `Only the assembly point imports routers` 兩條契約，`uncovered_modules` 會在萬用字元被改成明列模組時失敗。建議訊息 `feat: block cross-module and router imports between modules (#563)`。

- [x] 4.1 依 design D5（clarification Q5；specs「業務模組之間不得互相 import」「Router 只由組裝點 import」），以 TDD 在 `test_entry_contracts.py` 加樣本並新增兩條契約。**先寫樣本並跑出失敗**：模組 A 的 router import 模組 B 的 service（斷言輸出含 `Modules do not import each other` 與 `app.modules.health.router -> app.modules.other.service`）、新增第三個模組的 service import `health` 的 schemas（同一契約）、`app.main` 同時 import 兩個模組的 router 通過、模組 B 的 service import 模組 A 的 router（`Only the assembly point imports routers`）、同模組的 service import 自己的 router（同一契約）；契約還沒加時違規案例必須失敗，`cd backend && uv run pytest tests/unit/test_entry_contracts.py` 先看到。再把兩條契約（寫法依 design D5）加進 `pyproject.toml`，同步 `EXPECTED_CONTRACTS`，跑到通過。故意弄壞：暫時把 `independence` 的 `modules` 改成 `["app.modules.health"]`，確認新模組的案例失敗，還原 [@backend-developer]
- [x] 4.2 依 design D7（clarification Q5；specs「每個模組都受分層檢查」「應用組裝點可以匯入多個模組」的 MODIFIED delta），以 TDD 擴充 `test_layer_boundaries.py` 的 `uncovered_modules`：另驗 `Modules do not import each other` 的 `modules` 含 `app.modules.*`、`Only the assembly point imports routers` 的 `protected_modules` 含 `app.modules.*.router`。**先寫案例並跑出失敗**：把兩條契約改成明列 `health` 的假契約清單，斷言 `uncovered_modules(contracts, ["health", "brandnew"]) == ["brandnew"]`；新增組裝點案例，樣本樹中 `app/main.py` 匯入兩個 router 且另一個模組的 service import 其中一個 router 時，輸出含 `Only the assembly point imports routers`。實作後通過，真實設定下 `uncovered_modules` 回傳 `[]` [@backend-developer]
- [x] 4.3 本組收尾：`cd backend && uv run lint-imports` 輸出 `Contracts: 9 kept, 0 broken.`；`uv run ruff check . && uv run ruff format --check . && uv run mypy --strict app && uv run pytest` 以 0 結束，回報 passed 與 skipped 數；`test_layer_boundaries.py` 與 `test_entry_contracts.py` 各不超過 400 行 [@backend-developer]

## 5. 豁免註解測試

本組完成後，任何 `ignore_imports` 都必須帶理由與來源，任何契約都不得關閉過期警示。建議訊息 `test: require a reason and source for every ignored import (#563)`。

- [x] 5.1 依 design D6（clarification Q6；specs「檢查豁免必須帶理由與來源，過期即失敗」），以 TDD 新增 `backend/tests/unit/test_contract_exemptions.py`（模組 docstring 指向 B12、#563、clarification Q6）。**先寫測試並跑出失敗**：`find_bad_exemptions(path: Path) -> list[str]` 先只 `raise NotImplementedError`，案例用 `tmp_path` 寫的樣本設定檔：放行項緊接其上沒有註解失敗並點名契約與該條、`ignore_imports` 寫成單行陣列且含任一條放行失敗並點名契約（多行陣列、一條一行才通過）、註解沒有 issue 編號或規則編號失敗、註解含 `#563` 或 `B12` 通過、契約設定 `unmatched_ignore_imports_alerting = "warn"` 與 `"none"` 各自失敗並點名契約、真實 `pyproject.toml` 通過且沒有 `ignore_imports`；另寫一個過期放行案例：樣本樹的契約放行不存在的 import，`run_lint_imports` 以非 0 結束且輸出含 `No matches for ignored import`；`cd backend && uv run pytest tests/unit/test_contract_exemptions.py` 先看到失敗。實作以文字逐行掃描（`tomllib` 會丟掉註解；`ignore_imports` 須為多行陣列、一條一行）與 `tomllib` 讀契約鍵，跑到通過。故意弄壞：暫時在某契約加一條沒有註解的 `ignore_imports`，確認測試失敗並點名，還原 [@backend-developer]
- [x] 5.2 本組收尾：`cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy --strict app && uv run lint-imports && uv run pytest` 全部以 0 結束，回報 passed 與 skipped 數；`test_contract_exemptions.py` 不超過 400 行 [@backend-developer]

## 6. 後端總驗證

本組不新增程式，只在第 1 至 5 組之後確認整體狀態，把結果交給文件組引用。

- [ ] 6.1 在 `backend/` 依序執行：`uv run lint-imports`（`Contracts: 9 kept, 0 broken.`）；`uv run ruff check . && uv run ruff format --check . && uv run mypy --strict app`；`uv run pytest`（回報 passed 與 skipped 數，標 `postgres` 的測試在這次被跳過）；以本機 `docker run postgres:16` 提供 `TEST_DATABASE_URL` 再跑一次 `uv run pytest`，skipped 為 0（本機沒有 Docker 時停下回報，不以「交 CI 驗證」略過）；後端契約漂移指令（`openspec/config.yaml` operations.apply）沒有差異，確認與 `api-contract.md`「本次無 API 變更」一致；`git diff origin/main -- backend/app` 為空（本 change 不改 `app/`）；`git status --porcelain` 乾淨 [@backend-developer]

## 7. 規則文件（7.1、7.2 可平行）

本組在第 1 至 6 組落地後改寫文件，只寫已成立的檢查與契約名稱；四項待建置與標準庫 HTTP 客戶端如實標明。7.1、7.2 改不同的檔案，可平行；兩個 task 完成後由 7.3 交叉核對並整組提交一次，建議訊息 `docs: document the single-entry rule B12 (#563)`。

- [ ] 7.1 依 design D10（clarification Q1、Q7、Q8、Q10、N1、N5、N6、N8）改 `docs/development/rules/backend-agent-rules.mdx`：（a）新增 **B12 單一入口**，格式與 B1 的表與摺疊區塊相同：適用路徑 `backend/app/**`；禁止與正例；清單七項與寄信、OIDC、HTTP 客戶端三項的禁止清單（唯一來源，列出三條契約名稱與 `forbidden_modules`）；例外寫 design D8 的升級路徑；檢查方式寫契約名稱、`backend/pyproject.toml`、`test_entry_contracts.py`、`test_dependency_classification.py`、`test_contract_exemptions.py` 與 `test_layer_boundaries.py` 的契約名稱集合；尚未檢查寫取得目前使用者、cookie helper、CSRF middleware、`get_db` 四項的「待建置」與各自原因，以及標準庫 `urllib.request`、`http.client` 擋不了（不宣稱 Ruff `S310` 補得上）；註明入口也是測試替身應該放的位置。（b）B1 的檢查方式補一句指向 B12 取得入口與跨模組契約，不重複禁止清單；B5 的「待建置」旁加一句 import-linter 只能擋整個套件、擋不了 `text`。（c）文首「十一條」改「十二條」、description 與狀態段的 B1、B2、B6、B7、B11 列表補入 B12 的已建置部分，其餘仍標待建置。（d）§附錄來源對照的「各條規範的來源」加 B12 一列（issue #563、Epic #560、ADR-003 D3、ADR-004 D3 與 D4、ADR-008 D3、S1、S2、B3、clarification Q1–Q10）；§決策紀錄加 2026-11-25（#563）一列。完成判定：`git diff origin/main -- docs/development/rules/backend-agent-rules.mdx` 只含上述四處 [@technical-writer]
- [ ] 7.2 依 design D10（clarification §交給後續產出）改 `docs/development/rules/agent-rules.mdx` 與 `docs/development/rules/testing-agent-rules.mdx` 的狀態段與條數：`agent-rules.mdx` 狀態段的 backend 條列補入 B12（並確認 R2 經由 B1 檢查的說法仍然成立）；`testing-agent-rules.mdx` 的狀態段與 T9 表「import 邊界」列提到後端 import 檢查之處補入 B12 的契約，沒有對應敘述的地方不改。兩檔都不動 R2、T9 的其他文字，也不新增決策紀錄。完成判定：`git diff origin/main -- docs/development/rules/agent-rules.mdx docs/development/rules/testing-agent-rules.mdx` 只含狀態與條數 [@technical-writer]
- [ ] 7.3 本組收尾：先交叉核對：7.1 寫入的三條入口契約名稱與禁止清單、兩條跨模組契約名稱，與 `backend/pyproject.toml` 逐字相同（對每個名稱以 `grep -F` 在兩個檔案都有輸出）；7.1 寫的五個測試檔路徑存在；B12 標「已建置」的項目都有對應的契約或測試，標「待建置」的四項沒有被寫成已檢查；B1 與 B12 沒有各抄一份禁止清單；文首條數、狀態段與 7.2 兩檔的敘述一致。再在 repo 根目錄執行 `node scripts/check-specs.mjs docs`、`node scripts/check-citations.mjs --strict`、`pnpm check:er`（本 change 不動資料模型，應照常通過）、`pnpm format:check`，全部以 0 結束；`git status --porcelain` 只含本組的檔案 [@technical-writer]

## Workflow follow-up

- 全部 task 完成且工作區乾淨後，交 code-reviewer 審查：特別核對三條入口契約的 `source_modules` 恰為 `app.core`、`app.modules`、`app.main`、`app.scripts` 且都帶 `allow_indirect_imports = true`；沒有任何契約有 `ignore_imports` 或 `unmatched_ignore_imports_alerting`；`EXPECTED_CONTRACTS` 恰為九個名稱；`backend/app/`、`.semgrep/`、`ci.yml`、`scripts/check.mjs`、ADR-003、`architecture.mdx`、`backend-modules.mdx` 沒有 diff；新增與修改的測試檔各不超過 400 行。修正由實作角色另開 commit。
- acceptance-verifier 對照 `specs/backend-code-boundaries` 的每個 Scenario 驗收；其中「單一入口清單只有一個來源，無法機械檢查的項目要寫明」的三個 Scenario 沒有常駐測試，以 7.3 的 `grep -F` 交叉核對輸出與閱讀 `backend-agent-rules.mdx` B12、B1、B5 證明，其餘 Scenario 對應常駐測試；報告寫在本 change 目錄的 `acceptance.md`。人工驗收步驟：`cd backend && uv run lint-imports`（預期 9 kept, 0 broken）；`uv run pytest tests/unit/test_layer_boundaries.py tests/unit/test_entry_contracts.py tests/unit/test_dependency_classification.py tests/unit/test_contract_exemptions.py`；在暫存複本的 `app/modules/health/service.py` 加一行 `import resend`，跑 `lint-imports` 看到非 0 結束與「Mail only through its entry」，確認後丟棄複本（不在 repo 內留下違規檔）。本 change 沒有畫面，沒有登入角色與 URL。
- 與 #562 共用的三份規則文件：#562 已合併，若開工後 `origin/main` 的 `backend-agent-rules.mdx`、`agent-rules.mdx`、`testing-agent-rules.mdx` 又有變動，後合併者在自己的分支 merge `origin/main`，解衝突後重跑 7.3 再推。
- 驗收通過後由 ops 在合併前執行 `/opsx:archive`：把 `specs/backend-code-boundaries` 的 ADDED 與 MODIFIED delta 同步進主規格（Purpose 不改），歸檔改動進同一張 PR；再依合併條件（CI 每個 job completed 且 success、審查無阻斷意見、PR 可合併）合併。
