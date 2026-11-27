# Design

## Context

動機見 `proposal.md` §Why；要達成的行為見 `specs/api-schema-export/spec.md`。

現況與限制：

- `backend/app/main.py` 的 `create_app` 以 `api.include_router(health_router)`、`api.include_router(account_router)` 掛兩個模組，沒有帶 tag；兩個模組的 `APIRouter()` 也沒有 `tags`，所以匯出的 8 個 operation 沒有分組（`system-analysis.md` §參考檔案）。
- operationId 由 `backend/app/core/openapi.py` 的 `generate_operation_id` 算出，算法不看 tag；後處理 `install_openapi` 不碰 `tags`（`system-design.md` §元件與職責）。
- 匯出指令用 `json.dumps(sort_keys=True)`，只排序物件的 key、不排序陣列，所以頂層 `tags` 的宣告順序原樣進檔案（`system-design.md` §元件與職責「匯出指令」列）。
- 前端 Orval 用 `mode: "split"`，hook 與型別名稱只取決於 operationId 與 schema 名稱（`ui-design.md`、`api-contract.md` §端點總覽）。
- 分組規則目前沒有任何規則條號；clarification Q1 決定寫進 `docs/development/rules/api-agent-rules.mdx` A1，作為唯一的規則本文，其他各處連到 A1。

## Goals / Non-Goals

**Goals:**

- 一處宣告 tag 名稱、說明與順序，新模組只需在同一個檔案加兩行（掛載與宣告）
- 漏帶、重複帶、未宣告、空說明四種錯誤都由後端單元測試在 CI 擋下
- 規則本文只寫在 A1，五處角色檔、範本、clarify 兩份副本、`openspec/config.yaml`、`schema.yaml` 與 `backend-modules.mdx` 檢查清單都連到 A1，不各寫一份

**Non-Goals:**

- 不在 app 啟動或匯出時檢查 tag（clarification P6）
- 不自動驗「tag 名稱等於目錄名」（clarification P7）
- 不驗「宣告了卻沒有 operation 使用的 tag」（`system-design.md` §設計選項 B 末段，不在 P5 範圍）
- 不改 Orval 的產生模式、不改文件站 `openapi-renderer` 外掛

## Decisions

### D1：tag 在 `create_app` 掛載時帶上（A2）

決定與三個選項的比較見 `system-design.md` §設計選項 A（clarification P4）。補充實作層的要點：

- `OPENAPI_TAGS` 常數放在 `backend/app/main.py`，型別標成 `list[dict[str, str]]`（`mypy --strict` 要求），傳給 `FastAPI(openapi_tags=OPENAPI_TAGS)`
- `api.include_router(account_router, tags=["account"])`、`api.include_router(health_router, tags=["health"])`；模組的 `APIRouter()` 不寫 `tags`，因為 FastAPI 會把兩處的 tag 串接
- 掛載的先後不影響文件的分組順序（分組順序只看 `openapi_tags`），所以 `include_router` 的呼叫順序維持現狀，避免無關的路由順序變動

替代方案：A1（模組自己宣告）、A3（模組匯出 tag 物件），未採用的理由同 `system-design.md` §設計選項 A。

### D2：頂層順序照規格章節、`health` 最後

依 clarification Q2；契約內容見 `api-contract.md` §頂層 `tags`。`OPENAPI_TAGS` 目前只有 `account`、`health` 兩筆，順序寫死在 list 中，不另寫排序程式：模組數只有六個且由人新增，排序規則寫進 A1 與 `backend-modules.mdx` 檢查清單，由新增模組的人照章節位置插入；D3 的契約測試斷言目前的順序。

替代方案：在程式裡依一張「模組→章節號」表自動排序。未採用：多一層抽象、多一份要維護的對照表，而順序只影響文件顯示、不影響任何 wire 行為。

### D3：測試讀產生出來的文件（B1），三項檢查各一個測試函式

做法見 `system-design.md` §設計選項 B（clarification P5、P6）。補充：

- 放在 `backend/tests/unit/test_openapi.py`，沿用該檔既有的 `app` fixture（`create_app(make_test_settings(...))`），讀 `app.openapi()`
- 走訪 `paths` 時只取 HTTP method 的 key（`get`、`put`、`post`、`delete`、`patch`、`head`、`options`、`trace`），略過 `parameters`、`summary` 等
- 三個測試函式分別驗：恰好一個 tag、tag 在頂層宣告、頂層 `description` 去空白後非空；失敗訊息列出每個違規的 method、path 與實際值，對應 spec 的三個失敗 Scenario
- 另加一個契約測試（比照既有的 `test_the_account_operation_ids_follow_the_contract`），斷言頂層 `tags` 的 `name` 依序為 `account`、`health`，以及 8 個 operation 各自的 tag 值；新增模組時要一併更新這個測試，順序錯誤因此也會被擋下
- 失敗 Scenario 的反向驗證：另以一個測試專用的小型 FastAPI app（掛一條不帶 tag、一條帶兩個 tag、一條帶未宣告 tag 的路由，並給一筆空說明）呼叫同一個檢查邏輯，斷言它回報違規。為了讓正向與反向共用邏輯，把「列出違規」寫成測試檔內的 helper 函式（例 `collect_tag_violations(document)`），不放進 `app/` 程式碼（P6：不加啟動檢查）

替代方案：B2 走訪路由，或在 `create_app` 做啟動檢查。未採用的理由見 `system-design.md` §設計選項 B 與 clarification P6。

### D4：規則本文寫在 A1，其他各處只連過去

依 clarification Q1。A1 新增一小段「OpenAPI tag」：一個後端模組一個 tag、名稱等於 `backend/app/modules/` 下的目錄名、每個 operation 恰好一個且沒有例外（P3）、頂層宣告附非空英文說明、順序照規格章節且 `health` 最後（Q2）、掛載處帶 tag 而模組 `APIRouter()` 不寫、名稱對錯由審查把關；A1 開頭的速查表加一列 tag，並在 `api-agent-rules.mdx` §決策紀錄補一列。

其他各處只寫一句操作性的檢查項並連到 A1，模組名舉例照 ADR-003 D14（P1）：

| 檔案                                                                 | 加什麼                                                                                              |
| :------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `.claude/agents/backend-developer.md`                                | §API 與 OpenAPI 一條「掛 router 時指定模組 tag」；完成檢查清單一項                                  |
| `.claude/agents/code-reviewer.md`                                    | 審查清單一項「每個 operation 恰好一個 tag，且 tag 名稱等於所屬模組目錄名」                          |
| `.claude/agents/sd.md`                                               | api-contract 寫法一條「每個端點標 tag（模組）」；自我檢查一項                                       |
| `openspec/config.yaml`                                               | `rules.api-contract` 一條「端點總覽要有 tag（模組）欄，值等於所屬模組目錄名」                       |
| `openspec/schemas/label-suite-sdd/templates/api-contract.md`         | 端點總覽表加「模組（tag）」欄；每個端點段落加「模組（tag）」一行                                    |
| `openspec/schemas/label-suite-sdd/schema.yaml`                       | api-contract instruction 的端點欄位清單加 tag（模組）（P2）                                         |
| `.claude/agents/design-reviewer.md`                                  | 檢查清單一項「api-contract 每個端點都標了 tag，且等於所屬模組」                                     |
| `.claude/skills/clarify/SKILL.md`、`.agents/skills/clarify/SKILL.md` | operationId 檢查項旁加同一項；兩份副本本來就有差異，只在各自的 operationId 檢查項旁插入，不整份同步 |

替代方案：只改 issue 列的五處、不改 A1。未採用：clarification Q1 已決定；且 `openspec/config.yaml` `context` 要求技術 change 的 delta 追溯到規則條號。

### D5：常駐文件由寫那段程式的角色校正

`backend-modules.mdx` 的異動清單見 `system-design.md` §常駐文件異動；依 `rules.tasks`，由改 `main.py` 的 `backend-developer` 在同一個 task 內完成，不另拆 `technical-writer` task。`error-codes.mdx`、`endpoint-authorization.mdx`、`frontend-routes.mdx` 不受影響。

A1、角色檔、範本、`config.yaml`、`schema.yaml` 屬規則與工具文件，不是程式的校正，由 `technical-writer` 負責；它們只連到 A1，不依賴後端程式先落地。

## Risks / Trade-offs

- [名稱寫兩次：`include_router` 的 `tags` 與 `OPENAPI_TAGS` 的 `name` 拼字不一致] → 「tag 在頂層宣告」的測試擋下（spec Scenario「操作的分組未在頂層宣告時檢查失敗」）
- [有人在模組 `APIRouter()` 也寫了 tags，串接成兩個] → 「恰好一個 tag」的測試擋下；A1 與 `backend-developer.md` 寫明模組 `APIRouter()` 不寫 tags
- [tag 名稱與目錄名不同（例 `accounts`），但同時宣告在頂層，測試不會失敗] → 依 P7 由 `code-reviewer` 審查清單把關；已接受的取捨
- [將來在 `app/core/`、`app/oidc/` 掛不屬於模組的路由，測試直接失敗] → 依 P3 這是預期行為，屆時再決定歸屬
- [文件站 `openapi-renderer` 可能自行排序分組，與 `/docs` 順序不同] → 依 P8 不改外掛，驗收時兩個入口各看一次並在 `acceptance.md` 記錄；自行排序記為已知差異
- [前端重產後出現非預期的檔案或名稱差異] → 重產後以 `git diff --stat frontend/src/api/generated` 與 `git status --porcelain` 檢查；hook 名稱若有變動即停下回報（spec Scenario「前端產生的呼叫層名稱不變」）
- [將來用 tag 表達授權邊界（FR-082）會與「每個 operation 恰好一個 tag」衝突] → 依 P9 本次不處理；spec 寫明 tag 不表達授權邊界

## Migration Plan

- 無資料庫 schema 異動，沒有 Alembic migration，SQLite 與 PostgreSQL 都不受影響（`system-design.md` §資料模型異動）。
- 部署：只是 `openapi.json` 多出描述性欄位，請求與回應位元組不變，前端不需要與後端同步發布；正式層 `API_DOCS_ENABLED=false`，`/docs` 本來就不註冊。
- 回滾：revert 本 change 的 commit 後重新匯出 `backend/openapi.json` 與文件站副本、重產 `frontend/src/api/generated/`；沒有資料要還原。
