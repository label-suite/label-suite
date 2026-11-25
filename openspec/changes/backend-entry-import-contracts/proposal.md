# Proposal

## Why

Epic #560 要在技術債長出來之前加上機器防線。子單 #563 處理其中「同一件事有好幾份實作」這一類：前端的 HTTP（Orval mutator）與日期（`src/lib/date.ts`）已各只有一個入口並由 ESLint 擋住（F10、A6），後端還沒有對應的清單，也沒有機器檢查。後端規則文件已把幾件事寫成「單一」（S1 認證 dependency、S2 單一 CSRF middleware 與單一發 cookie 的 helper、B3 `get_db`），但沒有任何一份文件定義「單一入口清單」，也沒有任何一條會在 import 繞過它時失敗。#506 已合併，`backend-sqlite` job 已跑 `uv run lint-imports` 與 `uv run pytest`，新契約與新測試可直接掛在這兩個既有 gate 上。

今天 `backend/app/` 還沒有任何入口實作（寄信、OIDC、認證 dependency、對外 HTTP 呼叫皆為 0 處；唯一有實作的「單一」是 `core/db.py` 的 `get_db`），實測在 `origin/main` 上現有四個契約為 `4 kept, 0 broken`，下列任何候選契約在今天的 `app/` 命中都是 0，沒有既有違規要處理。所以本 change 定的是「清單與怎麼擋」，不是入口本身；入口由日後各自的功能 change 落地。

這是技術 change，`docs/specs/` 沒有對應的業務規格，不涉及使用者可見功能。需求依據為 issue、ADR 與規則文件條號（spec-migration D4；維護者 2026-11-20 裁定，#503）。

## What Changes

**以下全是候選，不是決定。** `system-analysis.md` 的 Q1 至 Q10 與 `system-design.md` 的 N1 至 N8 尚未由維護者決議（`clarification.md` 接著處理）；每題的選項、命中數與已實測的限制見該兩份文件，這裡只列出會因決議而成立或落空的工作。`system-design.md` 的實測更正了 sa 的幾個事實，本 proposal 一律採 sd 的版本：

- 入口不存在時，`source_modules = ["app"]` 加對該入口的 `ignore_imports` 會讓 `lint-imports` exit 1（L2）；可行寫法是 `source_modules` 明列「入口以外的頂層套件」（L3），並以守門測試補上新頂層套件不受檢的缺口。sa 的 Q3-A 照字面做不到。
- 每一條入口契約必須帶 `allow_indirect_imports = true`，否則入口一落地就誤報（L4）。
- 擋「模組之間互相 import」要用 `independence`，不是 `protected` 加 `allowed_importers = app.modules.*`（後者擋不到跨模組，L5）。sa 的 Q5-B 照字面做不到。
- `[project].dependencies` 今天是 8 個（含 `aiosqlite`），不是 7 個；比對相依名稱又依賴已安裝環境、看不到傳遞相依，所以 Q4 的分類改讀實際 import 圖（`grimp`），不讀宣告的相依。
- import-linter 只看 import 圖：cookie helper（S2）、CSRF middleware、`get_db`（B3）、B5 的 `text` 都不在能力範圍內（L8、L9）；標準庫的 HTTP 客戶端（`urllib.request`）也無法單獨擋。

候選工作項，標明取決於哪一題：

- **後端入口清單與禁止清單**（Q1）：以 `forbidden` 契約為每個「有專屬第三方套件」的入口擋住入口以外的 import（候選：寄信 `resend`／`smtplib`、Google OIDC `authlib`、對外 HTTP 客戶端 `httpx`／`requests`／`aiohttp`／`urllib3`）。清單選 D 時今天沒有可檢查的新契約；選 B 或 C 時 cookie helper、CSRF middleware、`get_db` 無法被 import-linter 檢查，是否接受「寫進清單、檢查標待建置」或改用 Semgrep 擋呼叫，由 N1 決定（Semgrep 的表達力 sd 未驗證）。HTTP 客戶端是「每個整合各自包裝」還是「共用一個」文件沒有來源（C2），也在 Q1。
- **入口位置**（Q2，已拆成兩題）：Q2a 對外整合放哪（`app/core/`、新頂層 `app/integrations/`、或留給第一個落地的 change）；Q2b 取得目前使用者放哪（使用者模組的公開檔、core 定義介面由使用者模組實作的反轉依賴、或放行 `core -> modules` 例外；後者會推翻既有 Requirement「共用層不依賴業務模組」，sd 不建議）。這等於第一次回應 ADR-003 D3「跨模組共用的 service 或 schema 沒有合適位置」的重新討論條件，除 Q2a-3 外會牽動 ADR-003、`architecture.mdx` 與 `backend-modules.mdx`。選新頂層套件時另需 `Top-level order` 契約（N7：與 `Core does not depend on modules` 重疊但不取代）。
- **契約形狀與不存在的入口**（Q3、Q4）：L3 的明列來源寫法；防「清單沒列到的新套件」的分類測試（讀實際 import 圖，扣除標準庫與一般套件與入口套件，未歸類即失敗）；`ENTRY_PACKAGES` 與契約 `forbidden_modules` 的一致性檢查。
- **跨模組單一入口**（Q5）：`independence`（`app.modules.*`）加 router 只准 `app.main` import 的 `protected` 契約；選此項會連動 `backend-code-boundaries` 的「每個模組都受分層檢查」「應用組裝點可以匯入多個模組」兩條與 `uncovered_modules()`。
- **豁免記法**（Q6）：`ignore_imports` 必帶理由與來源的測試，並斷言契約不得設 `unmatched_ignore_imports_alerting`；與 Q2a-1 在入口尚未落地時需要的 `"warn"` 會衝突，需白名單（見 sd Q6 節）。
- **測試**（Q9）：把 `test_layer_boundaries.py` 寫死的 `4 kept, 0 broken` 改為契約數加契約名稱集合、抽出共用的樹建立輔助、新增常駐違規樣本測試（候選檔：`tests/unit/import_tree.py`、`test_entry_contracts.py`、`test_dependency_classification.py`）；也可選擇一次性證明、只記在 `acceptance.md`。
- **規則文件寫回**（Q7、Q10）：新增 B12「單一入口」作為清單與禁止清單的唯一來源，B1 檢查方式只指向它；同步 `backend-agent-rules.mdx` 的文首條數與狀態段、§附錄來源對照、§決策紀錄、B5 的待建置旁補一句「import-linter 只能擋整個套件，擋不了 `text`」；`agent-rules.mdx`（R2）與 `testing-agent-rules.mdx`（T9 的「import 邊界」列）只在狀態段與條數同步。B3、B5、B9、S2 的「待建置」只改這次實際建成的部分，是否擴大見 Q10。
- **不動的部分（候選預設）**：`.semgrep/` 與 `test-boundary-checks` 不改（Q8）；`ci.yml`、`scripts/check.mjs` 及其測試不改，因為契約加在 `pyproject.toml`、新測試被既有 `uv run pytest` 撿到；`app/` 不新增檔案。

無破壞性變更：沒有 API、資料模型、畫面或權限的變動（見 `api-contract.md`、`ui-design.md`），不涉及任何標記員能到達的端點，測試集答案隔離不適用。唯一的行為變化是日後在 `backend/app/` 繞過單一入口的 import 會讓 CI 失敗；今天的 `app/` 零違規。

### 待決問題（皆未決，由 clarification 逐題問維護者）

`system-analysis.md` 的 Q1 至 Q10（技術建議見各文件，不是決定）：

| #   | 主題                                                                      |
| :-- | :------------------------------------------------------------------------ |
| Q1  | 單一入口清單包含哪些項目、各自範圍；HTTP 客戶端與官方 SDK 的關係（C2）    |
| Q2  | 入口放在哪裡（sd 拆成 Q2a 對外整合、Q2b 取得目前使用者；牽動 ADR-003 D3） |
| Q3  | 入口還不存在時契約怎麼寫（sd 更正：採 L3，不是 sa 原版）                  |
| Q4  | 如何防「清單上沒列到的新套件」（sd 建議以實際 import 圖分類）             |
| Q5  | 要不要規定模組之間只能經公開入口（sd 更正：用 `independence`）            |
| Q6  | 既有違規怎麼處理、要不要預先設計豁免機制（今天命中 0）                    |
| Q7  | 規則文件落點（B12 或併入 B1）、capability（既有或新增）、要不要 ADR       |
| Q8  | 清單出來後要不要回頭改 #562 的 `test-boundary-checks` 與 Semgrep          |
| Q9  | 違規樣本用常駐測試還是一次性證明                                          |
| Q10 | 範圍是否擴大到 B3、B5、B9、S2 的「待建置」                                |

`system-design.md` 的技術待決問題：

| #   | 主題                                                                                                        |
| :-- | :---------------------------------------------------------------------------------------------------------- |
| N1  | Q1 選 B 或 C 時，cookie helper、CSRF middleware、`get_db` 無法被 import-linter 檢查：標待建置，或用 Semgrep |
| N2  | 更正 sa：Q5-B 的 `protected` 寫法擋不到跨模組，改用 `independence`                                          |
| N3  | 更正 sa：Q3-A 的 `ignore_imports` 寫法做不到；相依數是 8 不是 7                                             |
| N4  | Q2b 反轉依賴的執行期接線今天無認證程式可驗證，sd 未驗證                                                     |
| N5  | `alembic/`、`tests/` 不在 import 圖，規則適用範圍只有 `backend/app/`                                        |
| N6  | 入口落地後改契約的規則（一個 change 加一條入口，還是批次）                                                  |
| N7  | `Top-level order` 與 `Core does not depend on modules` 重疊，是否取代                                       |
| N8  | 標準庫 HTTP 客戶端無法單獨擋，檢查強度寫進「尚未檢查」                                                      |

## Capabilities

### New Capabilities

無（候選）。若維護者在 Q7 選 Y，改為新增 `backend-single-entries`；sa 與 sd 皆建議不另立。

### Modified Capabilities

- `backend-code-boundaries`（候選，Q7 選 X 時成立）：ADDED 入口契約、分類測試與守門測試相關的 Requirement；視 Q5 另 MODIFIED「每個模組都受分層檢查」「應用組裝點可以匯入多個模組」使其與 `independence`、`protected` 契約對齊。Purpose「讓違反 B1 的 import 在合併前被擋下」已涵蓋本 change，不需改 Purpose。Requirement 數與內容取決於 Q1（契約數）、Q5、Q6、Q9。

若 Q3 選 B（只交付文件、不寫契約），則沒有 spec 層行為變化，需改設 `skip_specs: true`；這一點由 clarification 的 Q3 決議後在 specs 階段確認。`test-boundary-checks` 只在 Q8 選 B 時才會有 delta。

## Impact

- **設定**：`backend/pyproject.toml` 的 `[tool.importlinter]`（新增契約；`root_package = "app"`、`include_external_packages = true` 不變）。
- **測試**：`backend/tests/unit/test_layer_boundaries.py`（契約數斷言、`uncovered_modules()`）；候選新增 `tests/unit/import_tree.py`、`test_entry_contracts.py`、`test_dependency_classification.py`（Q4、Q9）。各檔須在 B11 的 400 行上限內（#561）。
- **文件（規則）**：`docs/development/rules/backend-agent-rules.mdx`（B12、B1、B5、文首、附錄、決策紀錄）、`agent-rules.mdx`、`testing-agent-rules.mdx`（T9）。
- **文件（取決於 Q2）**：`docs/development/adr/003-backend-architecture.mdx`、`docs/development/architecture.mdx`、`docs/diagrams/architecture/backend-modules.mdx`；Q2a-3 時只在 `backend-modules.mdx` 的新增模組檢查清單加一項。
- **specs**：`openspec/specs/backend-code-boundaries/`（候選，歸檔時同步）。
- **不改**：`backend/app/`（入口本身）、`.github/workflows/ci.yml`、`scripts/check.mjs` 與其測試、`docs/diagrams/architecture/error-codes.mdx`、`endpoint-authorization.mdx`、`api.openapi.json`、前端、資料表與 migration。
- **與兄弟 issue**：#561、#562 已合併；本 change 與它們共用 `backend-agent-rules.mdx`、`agent-rules.mdx`、`testing-agent-rules.mdx` 的狀態段與條數（#561 已加 B11，B12 接在其後）。`openspec/changes/` 目前只有本 change，無重疊。

## 不在範圍

- 實作任何入口（寄信、OIDC、認證 dependency、HTTP 客戶端）；入口屬各自的功能 change，本 change 不新增任何 `app/` 檔案（Q2、Q3 選骨架時除外，須維護者明確選擇）。
- Semgrep 的呼叫層規則（N1）與 `.semgrep/`、`test-boundary-checks` 的改動，除非 N1 或 Q8 決議要做；若要機械檢查方法呼叫，另開 change 並先驗證 Semgrep 的表達力。
- `alembic/` 與 `tests/` 的 import（不在 import 圖，N5）；測試端的替身邊界屬 #562。
- 前端（F10、A6 已有 ESLint 檢查）。
- #564（定期架構盤點，已 closed）、#566、#111 的七個 gate、#506 的 CI job；新增 CI job 或修改 `ci.yml`。
- B3、B5、B9、S2 其餘的「待建置」檢查，除非 Q10 選 B。
- `docs/specs/`、`docs/specs/00-prd.mdx` 與 `design/prototype/`；任何 UI 與 API 變動。

## 引用來源

- GitHub issue #563（六項工作項，blocked-by #506 已 closed）、Epic #560（§維護者裁定 2026-11-23：規則細節在子單以問答問維護者，agent 不自訂；§不在範圍）。
- `AGENTS.md`：Hard Rules、Language Rules、Agent Rules Index（「衝突不由 agent 裁決」「範圍鎖定」）。
- `docs/development/rules/backend-agent-rules.mdx`（B1、B3、B4、B5、B9、B10、B11、附錄、決策紀錄）、`security-agent-rules.mdx`（S1、S2）、`testing-agent-rules.mdx`（T4、T6、T9）、`agent-rules.mdx`（R1、R2）、`frontend-agent-rules.mdx`（F10）、`api-agent-rules.mdx`（A6）。
- ADR-003 D3（含「什麼情況要重新討論」）、ADR-004 D3、D4、ADR-008 D3；`docs/development/architecture.mdx` §後端分層。
- `openspec/specs/backend-code-boundaries/spec.md`、`openspec/specs/test-boundary-checks/spec.md`；兄弟單先例 `openspec/changes/archive/2026-11-25-size-complexity-limits/`、`.../2026-11-25-integration-no-self-mocks/`。
- 本 change 的 `system-analysis.md`（§現況盤點、§待決問題 Q1 至 Q10）、`system-design.md`（先決發現 L1 至 L10、Q2a／Q2b 拆分、技術待決 N1 至 N8）、`ui-design.md`（無 UI 變更）、`api-contract.md`（無 API 變更）。
