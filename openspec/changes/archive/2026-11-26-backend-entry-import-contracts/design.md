# Design

## Context

動機見 proposal.md §Why；十題 Q 與八項 N 的決議與理由全文見 `clarification.md` §待釐清項目（2026-11-25，維護者授權採建議，可依 Q 編號推翻回修），本文件不重述理由。機制的組成、各契約的已驗證寫法與命中數見 system-design §先決發現 L1–L10、§機制總覽、§契約設計、§Q3、§Q4、§Q6、§Q9；下文只寫那幾節沒有定下、實作前必須定下的決策，以及取捨與已知缺口。

現況限制（`origin/main`，2026-11-25）：

- `backend/pyproject.toml` 的 `[tool.importlinter]` 有四條契約（`Module layers`、`Routers do not use the data layer`、`Core does not depend on modules`、`Data layer does not import HTTP`），`root_package = "app"`、`include_external_packages = true`；`app/` 只有 `core`、`modules`（只有 `health`）、`main`、`scripts`。
- `backend/tests/unit/test_layer_boundaries.py` 含 `write`、`build_tree`、`run_lint_imports`、`append`、`load_contracts`、`uncovered_modules` 與寫死的 `"4 kept, 0 broken"`；測試以 `from tests.<…> import` 取共用檔（`pythonpath = ["."]`）。
- CI `backend-sqlite` job 已跑 `uv run lint-imports` 與 `uv run pytest`（`testpaths = ["tests"]`），新契約與新測試不需要改 CI。
- `backend-agent-rules.mdx` 目前十一條（B1–B11），B1 的檢查方式列出四條契約。#561（B11）、#562 已合併，B12 接在 B11 之後。

## Goals / Non-Goals

**Goals:**

- 在 `backend/app/` 繞過單一入口的 import（寄信、OIDC、HTTP 客戶端的第三方套件、跨模組、router）讓 `lint-imports` 或 `pytest` 失敗（specs `backend-code-boundaries`）。
- 清單外的新第三方套件、新頂層套件、過期或缺理由的豁免，也由常駐測試擋下。
- 每條新契約附常駐違規樣本，每個群組先對刻意違規的樣本跑出失敗。
- B12 成為清單與禁止清單的唯一來源，並如實寫出做不到的檢查。

**Non-Goals:**

- 實作任何入口、決定入口位置（Q2）；不新增 `app/` 檔案。
- Semgrep 呼叫層規則、`.semgrep/`、`test-boundary-checks`（Q8、N1）。
- `alembic/`、`tests/`（N5）；B3、B5、B9、S2 其餘「待建置」（Q10）。
- 不改 `ci.yml`、`scripts/check.mjs`、ADR、`architecture.mdx`、`backend-modules.mdx`，也不改 `docs/specs/`、`00-prd.mdx`、`design/prototype/`。

## Decisions

### D1 契約集合：在 `pyproject.toml` 加五條，共九條（Q1、Q3、Q5；system-design §契約設計、§Q5）

新增 `Mail only through its entry`、`Outbound HTTP only through its entry`、`OIDC only through its entry`（`forbidden`）、`Modules do not import each other`（`independence`，`modules = ["app.modules.*"]`）、`Only the assembly point imports routers`（`protected`，`protected_modules = ["app.modules.*.router"]`、`allowed_importers = ["app.main"]`）。三條入口契約的禁止清單依 specs 與 system-design §契約設計（寄信 `resend`、`smtplib`、`aiosmtplib`；OIDC `authlib`；HTTP `httpx`、`requests`、`aiohttp`、`urllib3`），`source_modules = ["app.core", "app.modules", "app.main", "app.scripts"]`，`allow_indirect_imports = true`。契約名稱沿用現有的英文句子風格，名稱就是測試的比對鍵（D7）。

替代方案：清單 A（只列四項）、C（加 Celery、Redis）、D（只列今天有實作的）見 system-design §Q1 的選項表；不採用理由同該表。

### D2 清單七項，機械檢查只有三項（Q1 B、C2、N1；system-design §Q1 的對應表、L9）

清單七項寫進 B12，import-linter 只能檢查有專屬第三方套件的三項。取得目前使用者、cookie helper、CSRF middleware、`get_db` 檢查標「待建置」，原因是 import 圖看不到方法呼叫與依賴注入接線（L9）。不用 Semgrep：表達力 sd 沒有驗證，且不在 issue 六個工作項內（N1、Q8）。HTTP 客戶端採「每個整合自己的包裝就是它的入口」（C2），所以三條契約的禁止清單不設共用 HTTP 層放行；代價是日後整合若想直接用 `httpx` 呼叫第三方 REST，要在該整合 change 內依 D8 升級契約，而不是放寬本契約。

### D3 入口不存在時用 L3 寫法，加守門測試補缺口（Q3；system-design L2、L3、L4、§Q3）

| 做法                                                                               | 結果                                                                               | 取捨                                                                                                              |
| :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **L3（採用）**：`source_modules` 明列四個頂層套件，`allow_indirect_imports = true` | 真樹 `KEPT`，不需入口存在；入口落地時不必動契約                                    | 不在清單內的新頂層套件不受檢，由守門測試補（下）；管不到「入口 A import 入口 B 的套件」，待入口落地時補契約（D8） |
| 守門測試取代 L3 的缺口                                                             | `app` 的每個頂層套件必須屬於四個受檢者或 `ENTRY_TOP_LEVEL_PACKAGES`，後者今天為空  | 增加一個要維護的常數；好處是新頂層套件一出現就被點名，不會悄悄逃出檢查                                            |
| `source_modules = ["app"]` 加 `ignore_imports`（sa 原版）                          | 入口不存在時 `lint-imports` exit 1（L2）；改成 `"warn"` 會關掉 Q6 倚賴的過期即失敗 | 否決：與 D6 衝突                                                                                                  |
| 先建空骨架入口                                                                     | 可行                                                                               | 否決：新增產品碼，且骨架形狀等於 Q2 的決定                                                                        |

守門測試的 `source_modules` 判讀：契約的檢查來源含 `app` 整體時，視為涵蓋所有頂層套件，不當成漏列（D8 (b) 的形狀）；已登記入口套件與明列檢查來源的互斥比對只針對明列的頂層套件名。

L3 的邊界：入口放在 `app/core/`（Q2a-1）時 `app.core` 在 `source_modules` 內，入口放行不了，必須用 `source_modules = ["app"]` 加 `ignore_imports`；這是 D8 的升級路徑之一，不是本 change 的問題。

### D4 第三方套件分類測試讀 import 圖（Q4 A＋D；system-design §Q4）

測試以 `grimp.build_graph("app", include_external_packages=True)` 取外部根套件，扣掉 `sys.stdlib_module_names`，要求剩下的每個套件屬於 `GENERAL_PACKAGES`（明列，初始 `fastapi`、`pydantic`、`pydantic_settings`、`sqlalchemy`、`starlette`，以真樹實測為準）或某入口的第三方套件。純函式 `unclassified_imports(root, general, entry_third_party)` 回傳未歸類的套件，兩份清單以參數注入（測試不改常數），真樹與 `tmp_path` 樣本樹共用。**行程邊界**：`tests/conftest.py` 已在 pytest 行程內 import 真實的 `app`，所以在 pytest 行程內對樣本樹呼叫 `grimp.build_graph("app")` 分析到的是真樹而不是 `tmp_path`。因此對樣本樹的分析 MUST 在子行程執行（與 `run_lint_imports` 相同：`cwd=root`、`PYTHONPATH=root`），回傳外部根套件集合後再於測試行程內比對清單；對真樹的案例可在行程內執行。所有呼叫 `grimp.build_graph` 的地方一律傳 `cache_dir=None`，不寫 `.grimp_cache`（grimp 自己會寫一份內容為 `*` 的 `.gitignore`，不需要另加 gitignore 的 task）。**命名釐清**（system-design 把兩種清單都叫 `ENTRY_PACKAGES`，實作上是兩件事）：`ENTRY_TOP_LEVEL_PACKAGES`（D3 的入口頂層套件，今天為空）與 `ENTRY_THIRD_PARTY`（鍵為入口契約的名稱字串，例如 `"Mail only through its entry"`，值為該入口的第三方套件，今天三個入口各一組、非空）。一致性測試要求 `ENTRY_THIRD_PARTY` 每一組與同名契約的 `forbidden_modules` 完全相同，任一邊多或缺都失敗並點名差異。兩個常數與契約名稱常數放在 `tests/unit/import_tree.py`，兩個測試檔共用。

不採讀 `[project].dependencies`（system-design §Q4 B）：看不到傳遞相依被直接 import，又要做發行名到 import 名的對照，且依賴已安裝環境。`grimp` 是 `import-linter` 的相依，已在 `uv.lock`；它的 API 屬 import-linter 的內部相依，升級時由 Dependabot 的 PR 帶出並在該 PR 重跑測試。

### D5 跨模組用 `independence`，router 用 `protected`（Q5 B；system-design L5、L6、§Q5）

`protected` 加 `allowed_importers = app.modules.*` 擋不到跨模組（`app.modules.*` 是「任一模組」，L5），所以用 `independence`；它一次擋掉 service、repository、schemas、router 的所有跨模組 import。router 另用 `protected` 限定只有 `app.main` 能 import（L6）。兩條都用萬用字元，今天命中 0。Q5-A（不做）與 Q5-C（先定公開入口檔）不採用：「哪個檔是公開入口」等第二個模組有實際需求時，在那個 change 以帶理由的 `ignore_imports` 放行（D6、D8），不另設機制。`uncovered_modules` 補驗兩條契約的萬用字元（D7）。

### D6 豁免記法：註解加測試，不設白名單（Q6 B；system-design L2、§Q6）

允許 `ignore_imports`，測試以文字掃描 `pyproject.toml`（`tomllib` 會丟掉註解），要求每一條放行的前一行是以 `#` 開頭的註解，且註解含 issue 編號（`#<數字>`）或規則編號（如 `B12`）。「前一行」只在每條放行各佔一行時有定義，所以 `ignore_imports` MUST 寫成多行陣列、一條一行；單行陣列含任一條放行即失敗（訊息要求改成多行）。**過期即失敗**由 import-linter 預設的 `unmatched_ignore_imports_alerting = "error"` 提供，前提是沒有契約改設 `"warn"` 或 `"none"`（L2 實測兩者都會讓過期放行悄悄通過），所以測試斷言沒有任何契約含該鍵。Q2 選 C，本 change 不需要 `"warn"`，所以沒有白名單；今天沒有任何豁免，測試在真樹上等於斷言 `ignore_imports` 不存在。Q6-C（比照 #561 的 `EXEMPTIONS` 表）不採用：import-linter 沒有對應的原生機制，要自寫一份表與同步測試。解析函式接受路徑參數，讓樣本設定檔可以證明失敗。

### D7 測試切分與契約名稱集合（Q9 A；system-design §Q9）

| 檔案                                                 | 內容                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| :--------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/import_tree.py`（新）                    | `write`、`build_tree`、`run_lint_imports`、`append`、`load_contracts`、`PYPROJECT`、`BACKEND_DIR` 與 D4 的常數、契約名稱常數；沒有 `test_` 前綴，不會被收集。`build_tree` 須另寫 `app/scripts/__init__.py`：樣本樹要含入口契約 `source_modules` 的每個頂層套件，否則 `lint-imports` 以 `Module 'app.scripts' does not exist.` 結束碼 1，全部樣本案例壞掉，只比對結束碼的案例還會因錯誤原因而通過。樣本案例一律斷言契約名稱加 `BROKEN`（或通過案例的 `0 broken`），不只看結束碼 |
| `tests/unit/test_layer_boundaries.py`                | 改為從 `import_tree` 匯入；`"4 kept"` 改為 `f"{len(load_contracts())} kept, 0 broken"`，另斷言契約名稱集合等於 `EXPECTED_CONTRACTS`；`uncovered_modules` 擴充                                                                                                                                                                                                                                                                                                                  |
| `tests/unit/test_entry_contracts.py`（新）           | 三條入口契約、`independence`、`protected` 的違規與放行樣本，D3 的守門測試                                                                                                                                                                                                                                                                                                                                                                                                      |
| `tests/unit/test_dependency_classification.py`（新） | D4 的分類測試與一致性測試                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `tests/unit/test_contract_exemptions.py`（新）       | D6 的註解測試與沒有 `unmatched_ignore_imports_alerting` 的斷言（system-design 沒指定檔名，這裡定下，讓一個檔對應一條規則）                                                                                                                                                                                                                                                                                                                                                     |

契約名稱集合與數量同時比對：只比數量會漏掉「刪一條、加一條」。名稱比對以純函式 `contract_name_diff(contracts, expected)` 實作，回傳缺少與多出的名稱，讓「刪一條同時加一條」可以用記憶體中的假契約清單證明會失敗。`uncovered_modules` 另驗 `Modules do not import each other` 的 `modules` 含 `app.modules.*`、`Only the assembly point imports routers` 的 `protected_modules` 含 `app.modules.*.router`，否則改成明列單一模組時新模組會漏檢。每個檔案須在 B11 的 400 行上限內（system-design 估計 50／150／120／60／約 60 行）；`EXPECTED_CONTRACTS` 隨每個新增契約的群組同步擴充，所以每個群組單獨提交都能通過 CI。

### D8 入口落地後怎麼升級契約（N6、N7；system-design §契約形狀、N6）

本 change 不定入口位置，但要定落地的升級方式，B12「例外」寫明。第一個落地入口的 change 在**同一個 change**裡升級該入口的契約，二擇一：（a）入口是新頂層套件（Q2a-2）：不動契約，把該套件登記進 `ENTRY_TOP_LEVEL_PACKAGES`，它因不在 `source_modules` 內而被放行；（b）入口在 `app/core/` 或 `app/modules/` 內（Q2a-1）：契約改成 `source_modules = ["app"]` 加帶理由與來源的 `ignore_imports`（入口已存在，不會報錯，D6 的測試接手管理）。兩種都要同步 `ENTRY_THIRD_PARTY` 與分類測試。一個入口一個 change，契約與入口一起審。落地入口的 change 也要以 MODIFIED 改寫本 change 的下列敘述，否則它們會過期：「入口與間接使用不算違規」的「今天沒有任何入口」、「`app` 底下每個頂層套件都受入口契約檢查」的「今天沒有已登記的入口套件」、「檢查豁免必須帶理由與來源，過期即失敗」的「設定檔沒有任何 `ignore_imports`」與「既有設定沒有任何豁免」Scenario（選 (b) 時）、「契約集合以數量與名稱比對」的「契約集合為九條」。選 (b) 時守門測試必須接受 `source_modules = ["app"]`（見 D3），不得把它當成漏列頂層套件。`Top-level order` 契約只在選（a）時才需要，那個 change 再加；system-design L7 已驗證 `layers = ["app.main", "app.modules", "(app.integrations)", "app.core"]` 可行，作為參考，且日後也不取代 `Core does not depend on modules`（N7）。

### D9 Q2 延後，與 ADR-003 D3 的關係（Q2 C、N4；system-design §Q2）

ADR-003 D3 的重新討論條件是「第一批模組合併後，審查反覆發現跨模組共用的 service 或 schema 沒有位置」。現況只有 `health` 一個模組，跨模組 import 為 0，條件字面上還沒觸發，所以本 change 不改 ADR-003、`architecture.mdx`、`backend-modules.mdx`。「取得目前使用者」（Q2b）的任何落點都會碰到 D3 與 `Core does not depend on modules`，屬架構決定，由第一個認證 change 在 clarification 問維護者；`independence` 一旦擋住它，那個 change 要在 D5 契約加帶理由的 `ignore_imports`（Q2b-1），或走反轉依賴（Q2b-2，接線由那個 change 驗證）。本 change 的貢獻是兩個方向的契約形狀都已實測可行（system-design §Q2 的選項表）。

### D10 規則文件（Q7、Q8、Q10、N1、N5、N8；system-design §Q7、Q8、Q10）

- `backend-agent-rules.mdx` 新增 B12「單一入口」：適用路徑 `backend/app/**`；清單七項與三項禁止清單（唯一來源）；例外寫 D8；檢查方式寫契約名稱、`pyproject.toml` 位置、樣本測試、守門與分類與豁免測試；尚未檢查寫四項待建置的原因與標準庫 HTTP 客戶端；註明入口也是測試替身應該放的位置（Q8）。
- B1 的檢查方式補一句指向 B12 取得入口與跨模組契約，不抄第二份表；B5 的「待建置」旁加一句「import-linter 只能擋整個套件，擋不了 `text`」。
- 同步文首條數（十一條改十二條）與狀態段（B12 的三項入口契約與跨模組契約已在 CI 跑，其餘四項仍標待建置）、§附錄來源對照加 B12 一列、§決策紀錄加 2026-11-25（#563）一列。不寫 ADR（Q7 P）。
- `agent-rules.mdx`、`testing-agent-rules.mdx` 只改狀態段、條數與 B12 的提及處，文字上指向 B1 檢查方式的 R2；`testing-agent-rules.mdx` 的 T9「import 邊界」列在後端分層之外補上「單一入口」，已建置的契約欄改為「F1、B1 與 B12」（tasks 7.2）。
- 與 #562 共用狀態段：#562 已合併，現行文字已含其內容；若本分支開工後 `origin/main` 的這三個檔又有變動，後合併者 merge `origin/main`，解衝突後重跑文件檢查。
- 不在 worktree 執行 NoteCraft 建置（`pnpm exec notecraftapp build docs --rebuild`）：這是對 `openspec/config.yaml` operations.apply 的明示偏離，沿用 #562 的先例（`openspec/changes/archive/2026-11-25-integration-no-self-mocks/design.md` D11）：指向 worktree 的建置會污染共用快取。動到 `docs/` 的 task 改以 `node scripts/check-specs.mjs docs`、`node scripts/check-citations.mjs --strict` 與 `pnpm format:check` 收尾，渲染驗證交給 CI 的 `docs-site` job。

### D11 已知缺口（如實寫進 B12，不宣稱已擋）

| 缺口                                                                          | 原因                                                                              | 出處       |
| :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :--------- |
| 取得目前使用者、cookie helper、CSRF middleware、`get_db` 沒有機械檢查         | import-linter 只看 import 圖，看不到方法呼叫與依賴注入接線；不用 Semgrep          | L9、N1、Q1 |
| 標準庫 HTTP 客戶端（`urllib.request`、`http.client`）擋不了                   | 外部套件只認根套件，`urllib` 整包會誤擋 `urllib.parse`；不宣稱 Ruff `S310` 補得上 | L8、N8     |
| 子模組與名稱擋不了（例：`sqlalchemy.text`、`sqlalchemy` 內的 `AsyncSession`） | 同上；B5 的 `text` 限制寫在 B5                                                    | L8、Q10    |
| `alembic/`、`tests/` 的 import 不受檢                                         | 不在 `root_package = "app"` 的圖內；B12 適用路徑只寫 `backend/app/**`             | L10、N5    |
| 入口 A import 入口 B 的套件                                                   | L3 的 `source_modules` 不含入口；入口落地時補契約                                 | D3、D8     |
| 新的第三方套件若歸為「一般套件」就不受入口限制                                | 分類由測試的明列清單決定，歸類本身要靠審查                                        | D4         |

## Risks / Trade-offs

- **契約被改寬或被刪**：由 D7 的契約名稱集合與常駐違規樣本擋下；改契約必須同步改清單，是刻意的摩擦。
- **L3 的守門測試與契約形狀綁在一起**：入口一落地就要同步 `ENTRY_TOP_LEVEL_PACKAGES` 與 `ENTRY_THIRD_PARTY`（D8）；忘了同步時守門與一致性測試失敗並點名，不會悄悄放行。
- **`grimp` API 變動**：分類測試依賴 `grimp.build_graph`；`uv.lock` 鎖定版本，升級由 Dependabot 的 PR 帶出，該 PR 的 `uv run pytest` 會失敗而不是悄悄略過。
- **文件超前於檢查**：B12 的四項待建置若被誤讀成已檢查會誤導；狀態段與 B12 檢查方式逐項標明「已建置」或「待建置」，並由 tasks 7.3 交叉核對。
- **`independence` 太嚴**：日後第二個模組要共用功能時一定會碰到；這是設計意圖，放行方式由那個 change 決定（D9）。

## Migration Plan

沒有資料模型、API、畫面或部署變動，不需要 migration，沒有資料需回復。設定與測試隨 PR 合併後立即在 `backend-sqlite` job 生效；今天的 `app/` 對九條契約皆 `KEPT`，不會有既有違規要處理。回滾是還原本 PR（`pyproject.toml`、測試檔與三份規則文件），沒有狀態需要清理。

## Open Questions

無。Q1 至 Q10 與 N1 至 N8 已由 clarification 決議；維護者推翻任一題時依 Q 編號回修 specs、design 與 tasks。
