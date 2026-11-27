# Design

本份只寫實作取捨與上游沒寫完的技術決定。分層、類別、序列圖、判斷順序、資料模型與權限檢查點以 `system-design.md` 為準；錯誤碼與各步對到的狀態以 `api-contract.md` 為準；本次無 UI 變更（`ui-design.md`）。動機見 `proposal.md` §Why，行為見 `specs/`。各決定都依 `clarification.md` 的決議（Q1–Q4、P1–P13）與 §交給後續產出。

## Context

- `app/core/auth.py` 已做授權第 1、2 段（`get_current_principal`、`PrincipalLoader` Protocol，由 `account` 實作、`app.main` 組裝時放進 `app.state`），只帶系統角色，沒有任務成員身分（主規格 `auth-guard`）
- 遷移鏈只有基準 `0dfb129ee036` 與帳號組 `7bf0f909ce8f`；`admin_role_permission`、`admin_role_permission_version` 在資料表字典與 ER 已有定義、未落地
- `backend/pyproject.toml` 的 import-linter 有九條契約，其中 `Core does not depend on modules`、`Module layers`（只有 `(models)` 可省略）、業務模組互不 import、router 只由 `app/main.py` import 四條直接約束本次
- `backend/tests/unit/test_size_limits.py` 對 `app/`、`tests/`、`alembic/` 每個 `.py` 檔設 400 行上限
- `critical-coverage.json` 的 `authorization` 一項目前只列 `app/core/auth.py`、`app/core/csrf.py`；CI 的 `coverage` job 以 `scripts/check-critical-coverage.mjs` 要求 90% 分支覆蓋
- `docs/development/architecture.mdx` §待決 第 2 列仍寫「第 2 步與第 4 步的資料由誰提供給 `app/core/`」未決
- 沒有任何對外端點會在本次掛上權限檢查（clarification P8、P9），整合測試只能以測試掛載的路由驗證

## Goals / Non-Goals

**Goals:**

- `specs/permission-authorization` 每一條 Scenario 都能以 unit 或 integration 測試在兩種資料庫上自動驗證，不依賴尚未存在的 `task`、`dataset` 模組
- `app.core` 對業務模組零 import；`admin` 模組以最小形狀落地，#729 只需加端點與編輯
- 初始矩陣的來源只有一份（白名單登錄表），migration 的字面值與它的一致由測試保證

**Non-Goals:**

- 任何 `task`、`dataset` 模組的程式：`TaskMembershipReader` 與各 `AccessCondition` 的真實實作屬 #763 起的功能卡；本次組裝點不放 reader
- 測試集辨識資訊的遮蔽本身（Q4）：只在條件種類預留 `acting_role`，不實作遮蔽；規格回寫在 #773、#777
- 待啟用鍵的「原本的閘門」與「矩陣之外」的平台硬邊界路徑（P4、P5）：各功能卡處理，`Authorizer` 不開旁路
- 矩陣的編輯、樂觀鎖、讀回整份驗證、稽核事件：#729

## Decisions

### D1 第 2、3、4 段的接法照 system-design（Q1 採 A1）

做法照 `system-design.md` §分層與類別、§授權判斷的固定順序：`app/core/authz.py` 定義 `PermissionMatrixProvider`、`TaskMembershipReader`、`AccessCondition` 三個 Protocol 與 `Authorizer`、`require_permission`、`GroundTruthBarrier`、`PermissionDeniedError`；`require_permission` 每次請求從 `request.app.state` 取 provider 與 reader 組出 `Authorizer`，不放模組層的全域狀態，測試直接以替身建構 `Authorizer`。

- 替代方案：A2 只做平台層、A3 第 4 段只做答案隔離（`system-design.md` §方案組 A）。不採用的理由在該表；維護者已選 A1
- `ConditionKind` 共七種：`task_ownership`、`task_state`、`assignment`、`reviewer_identity`、`dataset_visibility`、`answer_isolation`、`acting_role`（`system-design.md` §Class Diagram 的註記）。本次只有 `answer_isolation` 有真實實作（`GroundTruthBarrier`），其餘六種只用 `tests/support/authz.py` 的替身條件驗「條件不通過時格為開也拒絕」

### D2 白名單一份登錄表放 `app/core/permissions.py`（P2 採 B1）

24 個鍵以 `PermissionKey`（`StrEnum`）定義，識別名稱照 `system-design.md` §方案組 B 的表；每個鍵的 `PermissionSpec` 帶層級、06-02 的所屬段落、`enabled`、固定格與初始值。`applicable_cells()` 由登錄表推出 62 個適用格與初始值，是 migration 比對與回歸測試的唯一來源。

- 替代方案：B2 各模組提供自己的鍵、組裝時合併。不採用：06-02 的段落與後端模組不一對一，跨模組引用鍵會被 independence 契約擋（`system-design.md` §方案組 B）
- 認不得的鍵：`require_permission` 的參數型別是 `PermissionKey`，正式程式寫不出白名單外的鍵；`Authorizer` 仍對任何不在 `PERMISSION_REGISTRY` 的值回 `PermissionDeniedError`（S3「未知值一律拒絕」），測試以繞過型別的字串驗這一支

### D3 `admin` 模組不掛 router（Q2 採 C1、N3）

`app/modules/admin/` 放 `models.py`、`repository.py`、`service.py`，加上只有一個沒有路由的 `APIRouter` 的 `router.py` 與只有 docstring 的 `schemas.py`，滿足 `Module layers` 契約的四層必備；`create_app` 不掛 `admin` 的 router，`OPENAPI_TAGS` 不加 `admin`。`AdminPermissionMatrixProvider` 一次讀版本列與所需的格，不 commit。

- 替代方案：把 `router` 在契約裡改成可省略。不採用：會放寬所有模組的檢查（`system-design.md` 技術待決 N3）

### D4 初始矩陣以字面值的 data migration 寫入

一個 Alembic revision（`down_revision = "7bf0f909ce8f"`）建兩張表與檢查約束，再以 `op.bulk_insert` 寫入 62 格與版本列 `(1, 1, now)`；down 反序刪表。revision **不 import** `app.core.permissions`：已部署的 migration 不再改，登錄表日後會變；兩者一致由 integration 測試逐格比對（`specs/role-permission-matrix`「升級後的矩陣與白名單的初始值逐格相同」）。固定格的 CHECK 寫死系統管理類鍵與 `dashboard.view` 的識別名稱（`system-design.md` §資料模型異動）。

- 替代方案：初始化指令或啟動時補齊（`system-design.md` §方案組 C 的 C3）。不採用：前者多一個部署步驟，後者在組 app 時寫資料庫且讓「版本列不存在」永遠測不到
- 初始建立不寫稽核事件（P11）

### D5 不快取、只看用到的格（P10 採 D1、P3 採 E1）

每次授權讀一列版本與「一個鍵 × 一至三個角色」的格，用複合 PK 的索引，不另建索引。缺任何一個生效角色的格就拒絕；白名單外的鍵的列被忽略；固定格照讀到的值判斷，不以登錄表覆寫（資料庫 CHECK 保證不會是錯的值）。日後若要快取，做在 `PermissionMatrixProvider` 的實作那一側，`Authorizer` 與 Protocol 不改。

### D6 拒絕對到的錯誤（Q3 採 R1）

第 2 段（沒有生效身分、作用角色不是他的）與第 4 段看不到的資源丟既有的 `NotFoundError`，訊息與一般的找不到相同；第 3 段一律丟 `PermissionDeniedError`（繼承 `AppError`、`403`、`code` `PERMISSION_DENIED`、訊息鍵 `common.permission_denied`、不帶 `params`），由既有的 `handle_app_error` 轉成錯誤外層，不碰 cookie。`API_V1_ERROR_RESPONSES` 不加 `403`（`api-contract.md` §錯誤契約：PERMISSION_DENIED 的 OpenAPI 宣告）。

### D7 `task_membership_reader` 沒接上時大聲失敗（P13 的 N2）

本次組裝點不放 `app.state.task_membership_reader`。`require_permission` 遇到任務範圍的操作而 `app.state` 沒有 reader 時丟 `RuntimeError`，經未處理例外轉成 `500 INTERNAL_ERROR`，與 `principal_loader` 沒接上時同一種處理；不提供「永遠回空集合」的預設實作，以免接線錯誤被當成 `404` 掩蓋。測試以 `app.state` 放入 `FakeTaskMembershipReader` 驗任務範圍的行為，另有一個測試驗沒接上時是 `500`。

### D8 任務 ID 與作用角色只從路徑參數取，型別不對回 404（P13 的 N4）

`require_permission(key, task_id_param=..., acting_role_param=...)` 由端點宣告參數名，只讀 `request.path_params`，不讀 query 或 body（06-02 §一人多任務角色 第 6 條）。路徑上的任務 ID 不是合法 UUID、或作用角色不是三種任務角色之一時，`require_permission` 當成沒有生效身分，回 `404 NOT_FOUND`。

- 依據：FastAPI 0.165（`backend/uv.lock`）的 `solve_dependencies` 先執行子依賴、再驗證端點自己宣告的路徑參數，所以即使端點把 `taskId` 宣告成 `UUID`，型別錯的值也會先到 `require_permission`，對外結果就是 `404`，不會是 `422`
- 理由：與 S10「看不到的資源回 404」一致，也與「沒有成員身分」同一個回應，呼叫者無法從 `404` 與 `422` 的差別分辨格式與存在；所以這不留給後續的卡決定
- 驗證：探測路由宣告 `taskId: UUID`，integration 測試以 `not-a-uuid` 呼叫，斷言 `404 NOT_FOUND` 而不是 `422`（`specs/permission-authorization`「任務識別碼格式不對時當成找不到」）

### D9 測試的分層與檔案切分

400 行上限下，測試依關注點切成下列檔案；每個檔都要在 400 行內：

| 檔案                                                | 層          | 涵蓋                                                                                                                                                                     |
| :-------------------------------------------------- | :---------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/test_permission_registry.py`            | unit        | 24 個鍵與層級、5 個待啟用、62 個適用格、初始值、固定格（`specs/role-permission-matrix` 的白名單與初始值，不需資料庫的部分）                                              |
| `tests/unit/test_authorizer_platform.py`            | unit        | 3a–3d 平台層：認不得、待啟用、錯層、版本不存在、缺列、格為關、白名單外的列被忽略（以替身 provider）                                                                      |
| `tests/unit/test_authorizer_task.py`                | unit        | 2b：沒有身分、停用與邀請中（替身回空集合）、聯集、作用角色、作用角色不是他的、reader 沒接上                                                                              |
| `tests/unit/test_authorizer_conditions.py`          | unit        | 第 4 段：每種 `ConditionKind` 的替身條件不通過各一個負向測試、全部通過放行、格為關時不執行條件、`GroundTruthBarrier` 確實被呼叫且回 `404`                                |
| `tests/integration/test_admin_permission_schema.py` | integration | 兩張表、列數、錯層列不存在、約束名稱、固定格與版本的 CHECK、升降再升（`specs/database-migration` 與 `specs/role-permission-matrix` 的結構與約束）；不重抄 06-02 的逐格值 |
| `tests/integration/test_matrix_seed_parity.py`      | integration | 升級後的 62 列與 `applicable_cells()` 逐格相同、版本為 1（D4 的一致性保證）；逐格值的正確性由它與 `test_permission_registry.py` 兩處負責                                 |
| `tests/integration/test_admin_matrix_provider.py`   | integration | `AdminPermissionMatrixProvider` 對真實資料庫：版本不存在、缺列、白名單外的列、改格後下一次讀到新值                                                                       |
| `tests/integration/test_authz_platform.py`          | integration | 平台層探測路由：各角色的放行與 `403`、錯誤外層的內容與語系、沒有 `Set-Cookie`、角色降級後下一次被拒、`api-envelope` 的新 Scenario                                        |
| `tests/integration/test_authz_task.py`              | integration | 任務範圍探測路由（`app.state` 放替身 reader）：`404` 與找不到同訊息、聯集、作用角色、資源條件、標準答案                                                                  |

- 探測路由寫在新檔 `tests/authz_probe.py` 的 `add_authz_probes(router)`，由 `tests/probe.py` 呼叫 `add_authz_probes(probe_router)`，把路由直接加在既有的 `probe_router` 上；不用 `probe_router.include_router(...)`，因為 FastAPI 0.165 的 `include_router` 只在 `probe_router.routes` 留下一個延遲展開的 `_IncludedRouter`，`test_harness_parity.py` 的 `probe_paths()` 看不到裡面的路徑。`tests/conftest.py` 的掛載與 `probe_paths()` 都只認 `probe_router`，所以 parity 測試不必改，探測路徑仍只經這一個 router 加進 harness
- harness 多了授權探測路徑之後，`tests/integration/test_create_seeder.py::test_no_endpoint_creates_an_account` 改成檢查正式的 `create_app` 組裝，而不是測試 harness，讓「沒有任何端點會建立帳號」仍只針對正式端點判定
- 矩陣狀態的隔離：PostgreSQL 的測試共用一個資料庫，`upgrade head` 不會重寫已存在的列，改過或刪過矩陣的測試會污染之後的測試（例：刪掉版本列後所有授權都變 `403`）。`tests/integration/conftest.py` 新增 `matrix_db` fixture，在測試前後都把兩張表重設成 62 個初始格與版本 `1`：做法是刪光兩張矩陣表的列，再寫回系統管理組遷移（`4180e5b4471c`）自己的字面種子與版本列，不跑任何遷移，所以之後疊上去的遷移所建的表與資料都不受影響；種子取自遷移檔而不是 `applicable_cells()`，因為這樣重設出來的正是部署時的初始矩陣，也不必再抄第四份。會把資料庫降版的測試自己在結束前升回最新；任何會改、刪或新增矩陣列的測試（1.1 的 CHECK 測試、3.1 的 provider 測試、3.2 的整合測試）都要用它
- 與規格 06-02 同名的 Scenario（「錯層的格不儲存」「適用格的總數」「待啟用的鍵仍有適用列」「預設矩陣的平台層初始值」「預設矩陣的任務層初始值」）在本次只驗儲存與資料這一側；畫面上的呈現由 #729 驗。固定格的四條 Scenario 刻意不用 06-02 的名稱，因為那幾列的 When 是畫面操作
- 替身放 `tests/support/authz.py`：`FakeTaskMembershipReader`、`FakePermissionMatrixProvider`、`RefusingCondition(kind, error)`、`PassingCondition(kind)`
- 測試替身邊界檢查（`test-boundary-checks`）不受影響：替身是實作 Protocol 的新類別，經 `app.state` 注入，與 `principal_loader` 的測試做法相同，不替換本專案匯入的物件

### D10 覆蓋率關鍵路徑與架構待決結案

- `critical-coverage.json` 的 `authorization.backend` 加 `backend/app/core/authz.py`、`backend/app/core/permissions.py`、`backend/app/modules/admin/service.py`（system-design §權限檢查點 的覆蓋率門檻路徑；testing-agent-rules T10）；前端不變。`$comment` 改寫：答案隔離在授權層的落點（`GroundTruthBarrier`）已隨 `authz.py` 計入「授權與權限檢查」，答案隔離作為獨立一項、評分與 IAA 仍未建（#111）
- `docs/development/architecture.mdx` §待決 第 2 列移除，在 §決策紀錄 加一列：第 2 步任務成員身分與第 4 步附加條件由持有資料的模組實作 `app/core/` 定義的 Protocol 提供，指向 #755；§授權四步 正文若寫著該項未決，同步改成現況（照常駐文件寫法約束：正文不寫日期與 issue 編號）

### D11 常駐文件依實作校正

`backend-modules.mdx` 與 `error-codes.mdx` 已在規劃階段改成預定內容並標「規劃，待實作後校正」；實作角色在自己的 task 內把它們對齊實際的檔名、類別名與行為，並把決策紀錄的「規劃」字樣改成已落地。資料表字典與 ER 只加「已落地」標記與 revision，不改結構。`endpoint-authorization.mdx` 的已知限制「授權四步的第 3、4 步」一列改成現況。

## Risks / Trade-offs

- [Protocol 的形狀在沒有真實實作者時定下，#763 落地時可能要回頭調整] → 介面只收 `(db, task_id, user_id)` 與 `(context, db)` 這類最小參數；調整屬 #763 的 change，並受本次的 unit 測試約束
- [`app/core/` 帶了一份本產品的業務清單（24 個鍵）] → 機制仍通用，清單集中一檔、加鍵要經審查（06-02 §五個已登錄、待啟用的鍵 第 8 條）；ADR-003 D3 的邊界案例已在 `system-design.md` §方案組 B 記下
- [固定格 CHECK 寫死鍵名，日後新增系統管理類鍵要改約束] → 加鍵的 change 以新 migration 改 CHECK；SQLite 經 `render_as_batch` 重建表（已開啟），兩種資料庫的升降測試會擋住遺漏
- [migration 的字面值與登錄表日後不一致] → integration 測試逐格比對升級後的 62 列與 `applicable_cells()`，任何一邊改了另一邊沒改就失敗
- [任務層的判斷在 `task` 模組接上前一律 `500`] → 本次沒有任何任務層的正式端點；第一張掛任務層鍵的卡必須同時接上 reader，`backend-modules.mdx` §新增業務模組的檢查清單寫明
- [每個授權決定多兩次主鍵查詢] → ADR-004 D6 選擇第一版不快取；量測留給第一個高頻端點（下方 Open Questions）
- [`down` 會丟掉 #729 之後編輯過的矩陣] → 本次沒有編輯入口，down 只丟初始值；#729 的 migration 要另外說明它的回滾

## Migration Plan

1. 部署新版本時照常執行 `alembic upgrade head`：建兩張表並寫入 62 格與版本列；不需要任何額外指令，也不碰帳號組的表
2. 升級前後既有端點的行為不變（沒有端點掛權限檢查），所以升級與程式部署的先後順序不影響使用者
3. 回滾：先回到前一版程式，再執行 `alembic downgrade 7bf0f909ce8f` 刪除兩張表；本次表內只有初始值，不會遺失使用者資料
4. 驗證：兩種資料庫的 integration 測試跑「升到最新、降回帳號組、再升到最新」，並逐格比對初始矩陣

## Open Questions

- N5：每次授權多兩次查詢的實際延遲，在有真實端點之前量不到；由第一個高頻端點（04-02 標記寫入）量測 ADR-004 D2 的 P95 500 毫秒目標，屆時決定是否改依版本列快取。不影響本次的 specs、做法或 task 切分
