# Proposal

本份是 change `authz-steps-3-4`（issue #755）的提案。範圍、設計與契約分別以 `system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md` 為準，這裡只收斂成「為什麼做、改了什麼、動到哪些 capability」。

**本份寫在 clarification 之前。** `system-analysis.md` 的待決 1–17 與 `system-design.md` 的 N1 都還沒有維護者的決定；本份不替任何一題做決定。與待決無關的部分直接寫；範圍或 capability 會隨方案改變的部分，寫成「選某方案時才有」，並標出 sd 建議的是哪一個。每一題卡住哪些部分見 [§待決問題與它們卡住的部分](#待決問題與它們卡住的部分)。

## Why

授權四段目前只做到第 1、2 段的系統角色（`openspec/specs/auth-guard/`，login-auth-guard 待決 11 已決）：伺服器知道「是誰、帳號還能不能用、系統角色是什麼」，但沒有任何一處把操作對到權限矩陣的格，也沒有附加條件的檢查位置（`backend-modules.mdx` §已知限制「授權四步的第 3、4 步」）。#720 側欄、#721 無權限與找不到頁，以及 03-02、03-03、04-01、05-02 的第一張子卡（#759、#763、#773、#782）都 blocked-by 本單；維護者在 #753 檢查點 D1（2026-11-27）裁定第 3、4 段排在 #720 前面獨立做、矩陣先以預設值 seed、編輯畫面留給 #729。依 `AGENTS.md` 的 Shared infrastructure first，這套共用機制要在第一個需要它的功能單之前交付。

## What Changes

**授權第 3 段：操作對到白名單內、已啟用的權限鍵，要求對應角色那一格為開**（與待決無關，任何方案下都有）

- 共用層提供一份權限鍵白名單：24 個鍵（平台層 10、任務層 14）與鍵本身的屬性（層級、所屬段落、啟用與否、固定格、初始值）（規格 06-02 §權限鍵與它們對應的 PRD 格 第 1–11 條、§適用格，錯層的不存 第 1–7 條；資料表字典 §`admin`「角色權限矩陣」）。鍵的識別名稱見待決 4
- 判斷順序固定，任一步不通過就停、沒有預設允許：認不得的鍵與待啟用的鍵一律拒絕；鍵的層級與操作範圍不符拒絕；矩陣版本不存在拒絕；任一生效角色的格缺列拒絕（缺列不當成「關」）；生效角色的格全部為關拒絕（規格 06-02 §授權判斷的順序 第 1–8 條、§五個已登錄、待啟用的鍵 第 3 條；ADR-004 D6；security-agent-rules S3）
- 第 3 段的拒絕新增通用錯誤碼 `PERMISSION_DENIED`（`403`），錯誤外層不帶權限鍵、角色、任務、矩陣版本或拒絕在哪一步（`api-contract.md` §錯誤契約：PERMISSION_DENIED）
- 系統角色與任務成員身分每次從資料庫讀、不快取（S3、ADR-004 D2）
- 不放寬 PRD §權限矩陣 的任何一格，不新增任何角色；系統管理員沒有任務角色時拿不到任何任務層的鍵（PRD §權限矩陣 表下第 2 條、06-02 §授權判斷的順序 第 6 條）

**初始矩陣與矩陣版本**

- 依 06-02 §預設矩陣 的逐格初始值建立 62 個適用格與版本，作為授權判斷的資料與回歸測試的基準（issue #755；#753 D1；規格 06-02 §預設矩陣 第 1–8 條）。依據以 06-02 逐格值還是 PRD 的模組層級為準是待決 3
- 固定格（系統管理員 × 系統管理類鍵開、平台成員 × 系統管理類鍵關、兩種系統角色 × 檢視儀表板開）不能被改成別的值（06-02 §固定格不能改 第 1–5 條）
- **只在方案 C1（sd 建議）時**：本次開 `admin` 模組（沒有端點），建 `admin_role_permission` 與 `admin_role_permission_version` 兩張表（資料表字典既有候選表首次落地），以一個可逆的 Alembic data migration 寫入 62 格與版本列；`admin` 經共用層定義的介面提供矩陣（ADR-003 D14、ADR-004 D6）。選 C2 時本次沒有資料表與 migration，`admin` 只放一個由白名單初始值組出的記憶體內提供者；選 C3 時建表但初始矩陣改由初始化指令或啟動時補齊（`system-design.md` §方案組 C）
- 初始建立矩陣不寫稽核事件是 sd 的建議（待決 13）

**授權第 2 段的任務成員身分與第 4 段的附加條件**（範圍取決於方案組 A，待決 1、2、7）

- **選 A1（sd 建議）時**：共用層定義讀「某人在某任務生效中的任務角色」與「第 4 段附加條件」兩種介面，只以測試替身驗證；任務範圍的操作沒有生效成員身分（不是成員、已停用、仍在邀請中）一律拒絕；第 4 段在格通過之後依序檢查附加條件，格為開也蓋不過它們，每一種條件不通過各有一個負向測試（S3、06-02 §授權判斷的順序 第 2、4、5、7 條、issue #755 驗收條件第 3 列）
- **選 A2 時**：本次只做第 3 段平台層，任務層的鍵一律拒絕；issue #755 驗收條件第 3 列本次勾不掉，要由維護者同意縮小範圍
- **選 A3 時**：第 2 段同 A1；第 4 段只做答案隔離一種，其餘條件由各功能卡在自己的 service 檢查
- 附加條件的種類清單是待決 7（四處來源寫法不同，`system-analysis.md` 需求矛盾 C2）
- **答案隔離**（A1、A3 下都有）：宣告會讀標準答案的操作，對任何登入的人一律拒絕，沒有任何矩陣設定能打開它（PRD §不是角色的讀取對象、Hard Rule 6、S5）。測試集辨識資訊要不要依作用角色在授權層關閉是待決 N1
- 一人多任務角色時「任務頁面取生效角色的允許聯集」與「標記工作區只依選定的作用角色」兩種取法要不要本次就支援是待決 11（06-02 §一人多任務角色 第 1–7 條；sd 建議本次支援）

**拒絕對到的結果**（待決 12）

- 不論選哪一個方案都成立：看不到的資源回 `404 NOT_FOUND`，不以 `403` 洩漏存在；平台層的第 3 段拒絕回 `403 PERMISSION_DENIED`；第 1 段不通過維持既有的 `401 AUTH_REQUIRED`（`openspec/config.yaml` `rules.api-contract`；architecture §授權四步 第 4 條；S10）
- 任務範圍的拒絕各回 `403` 還是 `404` 依方案 R1（sd 建議）、R2、R3 而不同（`api-contract.md` §授權拒絕對到的 HTTP 狀態）

**不在本次**

- 角色設定頁的檢視、編輯、儲存、樂觀鎖、操作紀錄與讀回不合法時的畫面（規格 06-02，#729）
- 任何規格頁的功能端點與畫面；`ui-design.md`：本次無 UI 變更
- 任務成員身分、任務歸屬與狀態、指派與審核者、資料集可見性這些資料本身（`task`、`dataset` 模組，尚無程式）
- 「矩陣之外」的兩條路徑（系統管理員刪除草稿任務、全平台統計）在共用機制裡不開旁路是 sd 建議（待決 10）
- 5 個待啟用鍵的「原本的角色與資源閘門」由各操作所屬的功能卡定是 sd 建議（待決 9）
- 修改 `docs/specs/`、`docs/specs/00-prd.mdx` 與 `design/prototype/`

**BREAKING**：照 sd 建議（待決 16、17 都採「本次不做」）本次**沒有**破壞性變更：不新增端點、不改任何既有端點的路徑、request、response 或授權，`backend/openapi.json` 與前端產生的型別不變（`api-contract.md` §既有端點不變）。若待決 17 選「本次就讓既有端點對到平台層的鍵」，`getCurrentSession` 會多一個 `403`，屬 **BREAKING**，且要改 `auth-guard` 的既有 Requirement。

## Capabilities

### New Capabilities

- `permission-authorization`：授權判斷在第 1、2 段（`auth-guard`）之後的行為——操作對到白名單內、已啟用的權限鍵，鍵與操作範圍的層級相符，生效角色的格存在且至少一個為開，拒絕的結果與錯誤外層不外露的資訊，以及答案隔離在授權層的落點。**依方案而增減的 Requirement**：任務成員身分的判斷與聯集／作用角色的取法（A1、A3；待決 2、11）、第 4 段各種附加條件（A1 全部、A3 只有答案隔離；待決 1、7）、任務範圍拒絕的 `403`／`404`（待決 12）、讀到的矩陣不合法時的判斷（待決 8）、矩陣是否快取的可觀察行為「矩陣更新後下一次判斷依新值」（待決 6）、選「提供」時讓畫面讀取自己被允許的鍵的端點（待決 16）
- `role-permission-matrix`：權限矩陣這份資料本身的規則——24 個權限鍵與它們的層級、啟用狀態、適用格（62 個，錯層的格不存在）、固定格的永久值、每一格的初始值，以及矩陣版本。**依方案而增減的 Requirement**：持久資料與版本列、「版本列不存在」可被真實資料庫重現（只在 C1、C3；待決 5）；初始值的依據（待決 3）；鍵的識別名稱（待決 4）；初始建立是否留稽核事件（待決 13）。#729 之後在這個 capability 加編輯、樂觀鎖與讀回驗證

### Modified Capabilities

- `api-envelope`：Requirement「錯誤碼為大寫底線格式並定義第一批通用碼」的通用碼與 HTTP 狀態對應加入 `PERMISSION_DENIED`（403）（`api-contract.md` §錯誤契約：PERMISSION_DENIED；任何方案下都有）
- `database-migration`：**只在方案 C1、C3 時**加一條 Requirement——帳號組之後的 `admin` 組遷移建立兩張表、在 SQLite 與 PostgreSQL 產生相同的欄位與約束名稱、降回時依相反順序刪除；C1 另要求遷移寫入 62 格與版本列。選 C2 時不動這個 capability
- `auth-guard`：**只在待決 17 選「本次就對應」時**修改 `getCurrentSession` 等既有 Requirement；照 sd 建議不動
- `user-management`：**只在待決 4 決定改掉既有識別名稱 `admin.user_management.view`／`manage` 時**修改兩條 Requirement；照 sd 提案沿用既有名稱則不動

`backend-code-boundaries`、`ci-quality-gates` 的 Requirement 不變：新增的 `admin` 模組由「每個模組都受檢」的既有寫法自動涵蓋，授權的新檔案加進覆蓋率關鍵路徑清單屬清單內容，不改 Requirement。

## Impact

- **後端程式**：`backend/app/core/` 新增權限鍵白名單與第 3、4 段的判斷、依賴與錯誤型別；`app/main.py` 組裝時接上矩陣提供者；`app/i18n/{zh-TW,en}/messages.json` 加 `common.permission_denied`；`app.core` 仍不 import 任何業務模組（`backend-code-boundaries`）。方案 C1 下新增 `app/modules/admin/` 與一個 Alembic revision；方案 A1 下測試多一份任務成員身分與附加條件的替身。整合測試以只在測試掛載的探測路由代替受保護端點（`system-design.md` §分層與類別）
- **資料庫**：方案 C1、C3 下新增兩張表與可逆的 migration，兩種資料庫都要升級、降級、再升級；選 C2 時無異動。資料表字典與 ER 已有這兩張表，本次不改定義（`system-design.md` §資料模型異動）
- **API**：無新增或修改端點（待決 16、17 照 sd 建議時）；錯誤契約新增 `PERMISSION_DENIED`。`backend/openapi.json` 不變
- **前端**：無（`ui-design.md`）；待決 16 選「提供」時只會多出產生的 hook 與型別，不改畫面
- **常駐文件**：`error-codes.mdx` 已在 api-contract 那一步加 `PERMISSION_DENIED`；`backend-modules.mdx` 已加 `core/` 兩列與決策紀錄，`admin` 一節、app factory、錯誤對應、新增模組檢查清單、測試輔助與已知限制等 clarification 定案後依實作校正；`endpoint-authorization.mdx` 預期不變
- **品質門檻**：授權的新檔案加進「授權與權限檢查」的分支覆蓋率關鍵路徑清單（testing-agent-rules T10、`ci-quality-gates`）
- **後續卡**：#720、#721、#728、#729 與 #759、#763、#773、#782 依賴本次的判斷機制；方案 A1 下 `task` 模組（#763 起）要實作任務成員身分的介面，`task`、`dataset` 模組要實作各自的附加條件

## 引用的需求來源

- `docs/specs/00-prd.mdx`：§使用者角色 §角色清單、§權限矩陣（兩張表、表下條列、矩陣之外的平台硬邊界）、§不是角色的讀取對象；§模組架構與串接 §模組依賴
- 規格 06-02 角色設定：§權限鍵與它們對應的 PRD 格 第 1–11 條、§適用格，錯層的不存 第 1–7 條、§五個已登錄、待啟用的鍵 第 1–10 條、§預設矩陣：每一格的初始值 第 1–8 條、§讀回的矩陣不合法時 第 1–6 條、§授權判斷的順序 第 1–8 條、§一人多任務角色：聯集與作用角色 第 1–7 條、§固定格不能改 第 1–5 條、§卡控機制（授權相關各列）、§已確認決議 Q2、Q5、Q6、Q8、Q13
- 規格 03-01 §誰看得到哪些任務 第 6–8 條、§已確認決議 Q23；規格 07-01 §導覽項目與可見性、§進入模組的條件；規格 07-03 §返回操作的去處 第 3 條、§已確認決議 Q6
- `docs/specs/glossary.mdx`：§權限矩陣、§平台層的權限、§任務層的權限
- `docs/development/rules/security-agent-rules.mdx`：S3、S4、S5、S6、S10
- `docs/development/adr/004-auth-and-security.mdx`：D2、D6（含 2026-11-27 決策紀錄）
- `docs/development/adr/003-backend-architecture.mdx`：D12、D13、D14、§待決 第 1–2 列
- `docs/development/architecture.mdx`：§授權四步、§待決 第 2 列
- `docs/diagrams/architecture/backend-modules.mdx`、`data-table-dictionary.mdx` §`admin`
- issue #755 本文；#753 檢查點 D1；#729 本文驗收條件第 2 列
- 既有 capability：`auth-guard`、`user-management`、`api-envelope`、`database-migration`、`backend-code-boundaries`

## 待決問題與它們卡住的部分

本份不新增待決問題。下表只標出每一題卡住本 change 的哪一部分；問題本身與影響以 `system-analysis.md` §待決問題、`system-design.md` §需要維護者決定的方案、§技術待決問題 為準。

| 待決             | sd 建議                           | 卡住的部分                                                                                                                                                                                         |
| :--------------- | :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1、2、7          | A1；條件六種                      | `permission-authorization` 有沒有任務成員身分與附加條件的 Requirement、條件清單；`tasks.md` 有沒有替身與負向測試群組；issue #755 驗收條件第 3 列能不能本次勾掉；architecture §待決 第 2 列由誰關閉 |
| 3                | 06-02 逐格值                      | `role-permission-matrix` 初始值 Scenario 引用哪一份                                                                                                                                                |
| 4                | 沿用 5 個既有名、其餘 19 個照提案 | 白名單內容；`user-management` 要不要列入 Modified；兩個規格寫「沒有原始名稱」的鍵是否要走 `spec-writing`                                                                                           |
| 5                | C1                                | `admin` 模組與兩張表是否在本次；`database-migration` 要不要列入 Modified；`tasks.md` 有沒有 [@dba] 群組；「版本列不存在」能否以真實資料庫驗                                                        |
| 6                | D1（不快取）                      | `permission-authorization` 是否需要失效協定相關 Requirement；選 D2 須依 ADR-004 D6 先另做驗證                                                                                                      |
| 8                | E1                                | 讀到不合法矩陣時的拒絕 Scenario；系統管理員是否仍進得了角色設定頁                                                                                                                                  |
| 9                | 旗標停用                          | 待啟用鍵的 Scenario 範圍                                                                                                                                                                           |
| 10               | 不開旁路                          | 共用判斷是否有不經格的入口                                                                                                                                                                         |
| 11               | 本次支援                          | 聯集與作用角色兩種取法的 Requirement                                                                                                                                                               |
| 12               | R1                                | 任務範圍各步拒絕回 `403` 或 `404` 的 Scenario；選 R3 時與 `openspec/config.yaml` 的規則衝突，須先由維護者處理規則                                                                                  |
| 13               | 不寫稽核                          | 是否依賴 #757                                                                                                                                                                                      |
| 14               | —                                 | 不影響本 change 的產出，屬 GitHub 上的派工順序（見下節）                                                                                                                                           |
| 15               | —                                 | 只影響追溯：specs 追溯到 06-02 §授權判斷的順序 與 ADR／規則條號；若要補成 06-02 的業務流程，屬 `spec-writing`，由維護者處理                                                                        |
| 16               | 不提供                            | 有沒有新端點、`endpoint-authorization.mdx` 與前端產生型別是否變動、`ui-design.md` 是否要補一節                                                                                                     |
| 17               | 不改既有端點                      | 是否動到 `auth-guard` 與 `getCurrentSession`、是否有 **BREAKING**                                                                                                                                  |
| N1（sd 新增）    | —（需維護者決定）                 | 第 4 段是否多一種依作用角色關閉測試集辨識資訊的條件（多一種 `404`）；clarification 第 10 面向的結論                                                                                                |
| N2–N5（sd 技術） | 見 system-design                  | 技術取捨，交 design 與審閱核對，不改本份的範圍                                                                                                                                                     |

## 本 change 產出物之外、交給主 session 的動作

下列是 sa 提出、屬 GitHub 上的動作，不寫進任何產出物，也不由本 change 的實作角色執行：

- 待決 14：是否把 #728、#729 記為 blocked-by #755（目前 #728 只有 #727、#749、#750、#757；#729 只有 #728、#749，`system-analysis.md` 需求矛盾 C5）。依 `AGENTS.md` §Project Board and Dispatch，相依要記成 GitHub issue dependencies
- 待決 14：#729 本文「#728 若已需要第 3 步，由 #728 依同一做法先建」是否改成「接上 #755 的機制」，避免 #728 被派工時重做第 3 段
