# Proposal

## Why

Epic #560 要在技術債長出來之前加上機器防線。子單 #563 處理其中「同一件事有好幾份實作」這一類：前端的 HTTP（Orval mutator）與日期（`src/lib/date.ts`）已各只有一個入口並由 ESLint 擋住（F10、A6），後端還沒有對應的清單，也沒有機器檢查。後端規則文件已把幾件事寫成「單一」（S1 認證 dependency、S2 單一 CSRF middleware 與單一發 cookie 的 helper、B3 `get_db`），但沒有任何一份文件定義「單一入口清單」，也沒有任何一條會在 import 繞過它時失敗。#506 已合併，`backend-sqlite` job 已跑 `uv run lint-imports` 與 `uv run pytest`，新契約與新測試可直接掛在這兩個既有 gate 上。

今天 `backend/app/` 還沒有任何入口實作（寄信、OIDC、認證 dependency、對外 HTTP 呼叫皆為 0 處；唯一有實作的「單一」是 `core/db.py` 的 `get_db`），實測在 `origin/main` 上現有四個契約為 `4 kept, 0 broken`，下列任何候選契約在今天的 `app/` 命中都是 0，沒有既有違規要處理。所以本 change 定的是「清單與怎麼擋」，不是入口本身；入口由日後各自的功能 change 落地。

這是技術 change，`docs/specs/` 沒有對應的業務規格，不涉及使用者可見功能。需求依據為 issue、ADR 與規則文件條號（spec-migration D4；維護者 2026-11-20 裁定，#503）。

## What Changes

以下為 `clarification.md` 的決議（維護者 2026-11-25 授權採用建議；可依 Q 編號推翻回修）。`system-design.md` 的實測更正了 sa 的幾個事實，本 proposal 一律採 sd 的版本：

- 入口不存在時，`source_modules = ["app"]` 加對該入口的 `ignore_imports` 會讓 `lint-imports` exit 1（L2）；採 L3：`source_modules` 明列 `app` 底下現有的頂層套件，並以守門測試補上新頂層套件不受檢的缺口。
- 每一條入口契約帶 `allow_indirect_imports = true`，否則入口一落地就誤報（L4）。
- 擋「模組之間互相 import」用 `independence`，不是 `protected` 加 `allowed_importers`（後者擋不到跨模組，L5）。
- `[project].dependencies` 今天是 8 個（含 `aiosqlite`），不是 7 個；Q4 的分類改讀實際 import 圖（`grimp`），不讀宣告的相依。
- import-linter 只看 import 圖：cookie helper（S2）、CSRF middleware、`get_db`（B3）、取得目前使用者、B5 的 `text` 都不在能力範圍內（L8、L9）。

定案的工作項：

- **單一入口清單與入口契約**（Q1 B、Q3）：清單共七項，為寄信、Google OIDC、取得目前使用者、對外 HTTP 客戶端、發 session cookie 的 helper（S2）、CSRF 驗證 middleware（ADR-004 D3）、資料庫 session 取得（B3 的 `get_db`）。對外 HTTP 客戶端採「每個整合自己的包裝就是它的入口」，不另設共用 HTTP 層。有專屬第三方套件的三項（寄信、Google OIDC、HTTP 客戶端）各加一條 `forbidden` 契約，擋入口以外的 import，禁止清單依 `system-design.md` §契約設計；契約採 L3 寫法，不用 `ignore_imports`。另加守門測試：`app` 底下每個頂層套件都必須出現在每條入口契約的 `source_modules`。其餘四項的檢查標「待建置」並寫明原因（N1），不用 Semgrep。
- **分類測試**（Q4 A＋D）：以 `grimp` 讀 `app` 實際的 import 圖（扣掉標準庫），每個第三方套件必須歸類為「某入口的套件」或「一般套件（明列）」，未歸類即失敗；「某入口的套件」清單與契約的 `forbidden_modules` 由測試比對，必須一致。
- **跨模組單一入口**（Q5 B）：加 `independence` 契約（`app.modules.*` 彼此不得 import）與 `protected` 契約（`app.modules.*.router` 只准 `app.main` import）；今天命中 0。連動 `backend-code-boundaries` 既有 Requirement「每個模組都受分層檢查」「應用組裝點可以匯入多個模組」，使其與兩條新契約對齊。
- **豁免記法**（Q6 B）：允許 `ignore_imports`，但每一條必須有註解寫理由與來源，由測試檢查；測試同時斷言沒有任何契約設定 `unmatched_ignore_imports_alerting`，維持預設的 `error`，過期的豁免直接失敗。今天沒有任何豁免，沒有白名單。
- **測試**（Q9 A）：每條新契約在 `tmp_path` 樣本樹加常駐違規 case；`test_layer_boundaries.py` 寫死的 `4 kept` 改成比對契約數與契約名稱集合；樣本樹的共用 helper 抽成 `tests/unit/import_tree.py`。
- **規則文件寫回**（Q7 A、X、P；Q8 A；Q10 A）：`backend-agent-rules.mdx` 新增 B12「單一入口」，為清單與禁止清單的唯一來源，B1 的檢查方式只指向它。B12 適用路徑寫 `backend/app/**`（N5）；「例外」寫明入口落地時在同一個 change 升級該入口的契約並同步分類測試的入口套件清單（N6）；「尚未檢查」寫明標準庫 HTTP 客戶端（`urllib.request`、`http.client`）擋不了（N8），並註明入口也是測試替身應該放的位置。B5 的「待建置」旁加一句 import-linter 擋不了名稱（`text`）。同步文首條數與狀態段、§附錄來源對照、§決策紀錄；`agent-rules.mdx`、`testing-agent-rules.mdx` 只改對應的狀態與條數。不寫 ADR。
- **不動的部分**：`.semgrep/` 與 `test-boundary-checks` 不改（Q8 A）；`ci.yml`、`scripts/check.mjs` 及其測試不改，因為契約加在 `pyproject.toml`、新測試被既有 `uv run pytest` 撿到；`app/` 不新增檔案；B3、B5、B9、S2 其餘「待建置」不動，也不另開 issue（Q10 A）。

無破壞性變更：沒有 API、資料模型、畫面或權限的變動（見 `api-contract.md`、`ui-design.md`），不涉及任何標記員能到達的端點，測試集答案隔離不適用。唯一的行為變化是日後在 `backend/app/` 繞過單一入口的 import 會讓 CI 失敗；今天的 `app/` 零違規。

### 決議摘要

十題 Q 與八項 N 的決議、理由全文見 `clarification.md`；`system-analysis.md`、`system-design.md` 的選項比較保留為考慮過的選項。

| #   | 決議                                                                          |
| :-- | :---------------------------------------------------------------------------- |
| Q1  | B：七項清單；三項有專屬套件者以 `forbidden` 契約擋，其餘四項標待建置（N1）    |
| Q2  | C：本 change 不決定入口位置，留給第一個落地入口的 change（N4、N7 隨之不適用） |
| Q3  | A（L3 版）加守門測試                                                          |
| Q4  | A＋D：`forbidden` 契約加 import 圖分類測試                                    |
| Q5  | B：`independence` 加 router 的 `protected`                                    |
| Q6  | B：`ignore_imports` 必帶理由與來源，不設 `"warn"`，無白名單                   |
| Q7  | A、X、P：B12、既有 capability、不寫 ADR                                       |
| Q8  | A：不動 `.semgrep/` 與 `test-boundary-checks`                                 |
| Q9  | A：常駐樣本，契約數與名稱集合                                                 |
| Q10 | A：只改實際建成的部分                                                         |

## Capabilities

### New Capabilities

無。不新增 capability。

### Modified Capabilities

- `backend-code-boundaries`：ADDED Requirement 涵蓋入口 `forbidden` 契約、`app` 底下每個頂層套件都受入口契約檢查（守門測試）、第三方套件分類與入口套件清單一致、豁免須帶理由與來源且過期即失敗、常駐違規樣本；MODIFIED 既有「每個模組都受分層檢查」「應用組裝點可以匯入多個模組」，與 `independence`、router `protected` 契約對齊（Q5）。Purpose「讓違反 B1 的 import 在合併前被擋下」已涵蓋本 change，不需改 Purpose。

有 spec 層行為變化，不設 `skip_specs`。`test-boundary-checks` 無 delta（Q8 A）。

## Impact

- **設定**：`backend/pyproject.toml` 的 `[tool.importlinter]`（新增三條入口 `forbidden` 契約、`independence`、router `protected`；`root_package = "app"`、`include_external_packages = true` 不變）。
- **測試**（`backend-developer`）：`backend/tests/unit/test_layer_boundaries.py`（契約數與名稱集合、`uncovered_modules()`）；新增 `backend/tests/unit/import_tree.py`，以及入口契約與守門測試、分類測試、豁免註解測試的測試檔。各檔須在 B11 的 400 行上限內（#561）。
- **文件（規則）**（`technical-writer`）：`docs/development/rules/backend-agent-rules.mdx`（B12、B1、B5、文首條數與狀態段、附錄、決策紀錄）、`agent-rules.mdx`、`testing-agent-rules.mdx`（對應狀態與條數）。
- **specs**：`openspec/specs/backend-code-boundaries/`（歸檔時同步）。
- **不改**：`backend/app/`（入口本身）、ADR-003、`docs/development/architecture.mdx`、`docs/diagrams/architecture/backend-modules.mdx`（Q2 C）、`.semgrep/`（Q8 A）、`.github/workflows/ci.yml`、`scripts/check.mjs` 與其測試、`docs/diagrams/architecture/error-codes.mdx`、`endpoint-authorization.mdx`、`api.openapi.json`、前端、資料表與 migration。
- **與兄弟 issue**：#561、#562 已合併；本 change 與它們共用 `backend-agent-rules.mdx`、`agent-rules.mdx`、`testing-agent-rules.mdx` 的狀態段與條數（#561 已加 B11，B12 接在其後）；與 #562 共用狀態段時，後合併者 merge `origin/main`。

## 不在範圍

- 實作任何入口（寄信、OIDC、認證 dependency、HTTP 客戶端），本 change 不新增任何 `app/` 檔案。
- 入口位置：對外整合與取得目前使用者放哪（Q2），延後到第一個落地該入口的功能 change 決定，契約也在那個 change 升級（N6）；本 change 不加 `Top-level order` 契約，不改 ADR-003 D3、`architecture.mdx`、`backend-modules.mdx`。
- Semgrep 的呼叫層規則與 `.semgrep/`、`test-boundary-checks` 的改動（Q8、N1）；若要機械檢查方法呼叫，另開 change 並先驗證 Semgrep 的表達力。
- 取得目前使用者、cookie helper、CSRF middleware、`get_db` 的檢查，以及標準庫 HTTP 客戶端（N1、N8）：標待建置或列為尚未檢查。
- `alembic/` 與 `tests/` 的 import（不在 import 圖，N5）；測試端的替身邊界屬 #562。
- 前端（F10、A6 已有 ESLint 檢查）。
- #564、#566、#111 的七個 gate、#506 的 CI job；新增 CI job 或修改 `ci.yml`。
- B3、B5、B9、S2 其餘的「待建置」檢查（Q10 A）。
- `docs/specs/`、`docs/specs/00-prd.mdx` 與 `design/prototype/`；任何 UI 與 API 變動。

## 引用來源

- GitHub issue #563（六項工作項，blocked-by #506 已 closed）、Epic #560（§維護者裁定 2026-11-23：規則細節在子單以問答問維護者，agent 不自訂；§不在範圍）。
- `AGENTS.md`：Hard Rules、Language Rules、Agent Rules Index（「衝突不由 agent 裁決」「範圍鎖定」）。
- `docs/development/rules/backend-agent-rules.mdx`（B1、B3、B4、B5、B9、B10、B11、附錄、決策紀錄）、`security-agent-rules.mdx`（S1、S2）、`testing-agent-rules.mdx`（T4、T6、T9）、`agent-rules.mdx`（R1、R2）、`frontend-agent-rules.mdx`（F10）、`api-agent-rules.mdx`（A6）。
- ADR-003 D3（含「什麼情況要重新討論」）、ADR-004 D3、D4、ADR-008 D3；`docs/development/architecture.mdx` §後端分層。
- `openspec/specs/backend-code-boundaries/spec.md`、`openspec/specs/test-boundary-checks/spec.md`；兄弟單先例 `openspec/changes/archive/2026-11-25-size-complexity-limits/`、`.../2026-11-25-integration-no-self-mocks/`。
- 本 change 的 `system-analysis.md`（§現況盤點、§待決問題 Q1 至 Q10）、`system-design.md`（先決發現 L1 至 L10、Q2a／Q2b 拆分、技術待決 N1 至 N8）、`ui-design.md`（無 UI 變更）、`api-contract.md`（無 API 變更）。
