# Clarification

## 檢查範圍

關卡模式：檢查 `system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`、`proposal.md` 五份產出。specs、design、tasks 尚未產生，相關檢查項標「後續產物」。

本 change 是共用基礎建設，不對應規格頁的驗收標準列；需求依據是 `security-agent-rules.mdx` S3（與 S4、S5、S6、S10）、ADR-004 D2／D6、ADR-003 D12–D14、`docs/specs/00-prd.mdx` §權限矩陣、規格 06-02 角色設定的授權條文，以及 issue #755 與 #753 的 D1。`sa` 的待決問題 1–17 與 `sd` 新增的 N1–N5 逐條處理如下：四題為 Q，其餘為 P。

## 檢查結論

| 面向             | 結論                                                                                                                                                                                                       | 問題數 |
| :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 規格完整性       | 待釐清（Q1 第 4 步做到哪裡、Q2 矩陣資料是否落地）；specs 涵蓋度屬後續產物                                                                                                                                  | 2      |
| API Contract     | 待釐清（Q3 各步回 403 或 404）；沒有新增或修改端點，`PERMISSION_DENIED`（403）的外層與不外露內部資訊已寫明                                                                                                 | 1      |
| 邏輯一致性       | 問題（P1 初始矩陣的依據、P2 鍵名、P10 快取的兩處說法）                                                                                                                                                     | 3      |
| 可行性           | 通過：Protocol 接法同 `PrincipalLoader`，`app.core` 不 import 業務模組（ADR-003 D12、ADR-004 D6）；`admin` 模組需有 `router.py` 與 `schemas.py` 才符合 `Module layers` 契約（N3，已在 system-design 寫明） | 0      |
| 邊界情況         | 問題（P3 讀到不合法矩陣、P4 待啟用的鍵、P5 矩陣之外的路徑、P6 多角色）                                                                                                                                     | 4      |
| 跨功能影響       | 問題（P7 #728、#729 的依賴與 #729 本文）；`error-codes.mdx` 已加 `PERMISSION_DENIED`，`endpoint-authorization.mdx` 等實作後校正                                                                            | 1      |
| 可測試性         | 通過：第 3 步每種拒絕、第 4 步每種附加條件都有負向測試；`GroundTruthBarrier` 不需業務資料，可實測                                                                                                          | 0      |
| 規格範圍         | 問題（P8 讀取自己權限的端點、P9 既有端點、P11 稽核、P12 規格書業務流程）：都不在本次                                                                                                                       | 4      |
| 任務設定驅動     | 通過：權限鍵是 06-02 的固定登錄，不依任務類型分支                                                                                                                                                          | 0      |
| 測試集答案不外露 | 待釐清（Q4 測試集辨識資訊依作用角色或持有角色遮蔽）；讀標準答案的操作由 `GroundTruthBarrier` 對所有登入者關閉，矩陣沒有、也不會有它的格                                                                    | 1      |

## 決議（Q）

### Q1. 第 4 步的附加條件做到哪裡（待決 1、2、7）

- **來源**：`system-analysis.md` 待決 1、2、7；`system-design.md` 方案組 A；`docs/development/architecture.mdx` §待決 第 2 列
- **問題**：任務成員身分、指派、審核者與答案隔離需要的資料，目前沒有 `task` 模組提供。
- **決議**：採 A1。`app/core/` 現在就定義 `TaskMembershipReader` 與 `AccessCondition` 兩個 Protocol，由持有資料的模組實作，`app/main.py` 組裝時接上（同 `PrincipalLoader`）；本次以測試替身驗證，每種附加條件各一個負向測試，證明「條件不通過時，即使格為開也拒絕」。`GroundTruthBarrier` 不需業務資料，本次實測。授權第 2 步的任務成員身分也走 `TaskMembershipReader`。
- **理由**：issue 驗收第 3 項本次就能完成；`architecture.mdx` §待決 第 2 列（授權第 2、4 步的資料由誰提供）可以關閉。
- **已回修**：`system-design.md` 方案組 A 定案為 A1；`proposal.md` 移除 A2、A3 的條件句；`architecture.mdx` §待決 第 2 列移到決策紀錄（tasks 加一項，後續產物）
- **日期**：2026-11-27

### Q2. 權限矩陣的資料是否本次落地（待決 5）

- **來源**：`system-analysis.md` 待決 5；`system-design.md` 方案組 C
- **問題**：24 個鍵、62 格與版本列依 ADR-003 D14 歸 `admin` 模組，而 `admin` 模組尚未實作，編輯畫面在 #729。
- **決議**：採 C1。本次開 `admin` 模組（models、repository、service，加上沒有對外路由、不掛進 app 的 `router.py` 與 `schemas.py`），建 `admin_role_permission`、`admin_role_permission_version` 兩張表（字典與 ER 已有），以 data migration 寫入初始矩陣與版本列；`admin` 的 service 實作 `PermissionMatrixProvider`。#729 只做編輯。
- **理由**：#729 不必再建表與初始值；授權判斷本次就讀真實資料。
- **已回修**：`system-design.md` 方案組 C 定案為 C1；`proposal.md` 的 `admin` 模組、兩張表、`database-migration` Modified 改為確定；tasks 需有 `[@dba]` 群組（後續產物）
- **日期**：2026-11-27

### Q3. 授權各步拒絕時回 403 或 404（待決 12）

- **來源**：`system-analysis.md` 待決 12；`api-contract.md` §授權各步的回應（R1–R3）
- **問題**：任務範圍內的拒絕回 403 還是 404。
- **決議**：採 R1。第 2 步沒有生效的任務成員身分，或作用角色不是他的 → 404；第 3 步平台層不通過 → 403；第 3 步任務層、已確認是成員 → 403；第 4 步遇到看不到的資源（含 `GroundTruthBarrier`）→ 404；第 4 步狀態不允許的回應由各功能卡定。未登入回 401、看不到的資源回 404 照舊。
- **理由**：不是成員的人探不出任務是否存在；已是成員的人看得到任務，回「沒有權限」。
- **已回修**：`api-contract.md` 只留 R1；`error-codes.mdx` 補各步的分配（由 `sd` 回修）
- **日期**：2026-11-27

### Q4. 測試集辨識資訊依作用角色或持有角色遮蔽（N1）

- **來源**：`system-design.md` 待決 N1
- **問題**：同一人在同一任務同時是專案負責人與標記員時，「某個項目是不是測試集題目」在什麼情況下要遮蔽，規格沒有寫。
- **決議**：依作用角色：以標記員身分（作用角色 `annotator`）進入時遮蔽；以專案負責人身分進入管理頁時看得到。
- **理由**：與 06-02「工作區只依作用角色」一致。
- **已回修**：決議改變需求，需回寫規格 04-01 標記清單與 04-02 標記工作區；規格書由維護者擁有，回寫走 `spec-writing`，不在本 change 內做，追蹤於 #773（04-01（一））與 #777（04-02（一））。本 change 只在 `AccessCondition` 預留依作用角色判斷的條件型別，不實作遮蔽（04-01、04-02 尚無測試集資料）
- **日期**：2026-11-27

## 已修正（P）

| 編號           | 位置                                     | 問題                                                                                 | 修正                                                                                                                                                                                                                              |
| :------------- | :--------------------------------------- | :----------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1（待決 3）   | `proposal.md`、`system-design.md`        | issue 寫「PRD 預設值」，但 PRD 沒有逐鍵的值                                          | 以規格 06-02 §預設矩陣 逐格為準；`sa` 已逐格對過 PRD，沒有放寬                                                                                                                                                                    |
| P2（待決 4）   | `system-design.md` 方案組 B 的鍵名提案表 | 24 個鍵只有 5 個在 repo 出現                                                         | 採 B1（登錄表集中在 `app/core/permissions.py`）；沿用既有 5 個鍵名（含 `admin.user_management.view`、`manage`），其餘 19 個採 `sd` 的提案名；06-02 寫明「沒有原始名稱」的兩個鍵也用提案名，不改規格書                             |
| P3（待決 8）   | `system-design.md` 方案組 E              | 讀到不合法的矩陣時怎麼處理                                                           | 採 E1：只看這次用到的格，缺列或層級不符就拒絕該操作；固定格由資料庫 CHECK 保證；系統管理員仍進得了角色設定頁去修                                                                                                                  |
| P4（待決 9）   | `system-design.md` 方案組 F              | 5 個待啟用的鍵                                                                       | 登錄表標 `enabled=False`，判斷時一律拒絕，矩陣仍收它們的列（06-02）                                                                                                                                                               |
| P5（待決 10）  | `system-design.md` 方案組 F              | 系統管理員刪除草稿任務、看全平台統計等矩陣之外的路徑                                 | `Authorizer` 不開旁路；這些路徑由各自的功能卡處理                                                                                                                                                                                 |
| P6（待決 11）  | `system-design.md` 方案組 F              | 一人多角色                                                                           | 本次支援：任務頁面取生效角色的聯集，工作區只依作用角色（06-02）                                                                                                                                                                   |
| P7（待決 14）  | GitHub                                   | #728、#729 沒有記 blocked-by #755；#729 本文寫「#728 若已需要第 3 步，由 #728 先建」 | 主 session 在 GitHub 上把 #728、#729 記成 blocked-by #755，並在 #729 留言說明第 3 步改由 #755 提供                                                                                                                                |
| P8（待決 16）  | `api-contract.md`、`ui-design.md`        | 要不要提供讓畫面讀取自己權限的端點                                                   | 不在本次（issue 範圍沒有）；由第一個需要它的畫面卡（#720）提出                                                                                                                                                                    |
| P9（待決 17）  | `api-contract.md`                        | 既有端點要不要本次就對應到權限鍵                                                     | 不改；八個既有端點不變，沒有 BREAKING 變更                                                                                                                                                                                        |
| P10（待決 6）  | `system-design.md` 方案組 D              | ADR-004 D6 寫第一版不快取，issue 寫可依版本列快取                                    | 照 ADR-004 D6，不快取；issue 的寫法是允許、不是要求                                                                                                                                                                               |
| P11（待決 13） | `system-design.md` 方案組 F              | 初始矩陣要不要寫稽核事件                                                             | 不寫；稽核紀錄由 #757 建立，初始矩陣是 migration 寫入、不是使用者操作                                                                                                                                                             |
| P12（待決 15） | 規格書                                   | 要不要把授權判斷補成 06-02 的業務流程                                                | 不在本次；本 change 不改 `docs/specs/`                                                                                                                                                                                            |
| P13（N2–N5）   | `system-design.md`                       | 技術取捨                                                                             | 交給 design：沒接上 `TaskMembershipReader` 時丟 `RuntimeError`（N2）；路徑參數型別錯時的狀態原交給第一個任務層端點定（N4），規劃審閱後由 design D8 定案為 404（FastAPI 先執行依賴、後驗端點的路徑參數）；效能待真實端點再量（N5） |

## 移出本次的驗收標準

無。本 change 不對應規格頁的驗收標準列。

## 交給後續產出

- spec delta：新增 `permission-authorization`（Q1 的 A1、Q3 的 R1、P3–P6、P10）與 `role-permission-matrix`（Q2 的 C1、P1、P2、P4），修改 `api-envelope`（`PERMISSION_DENIED`）與 `database-migration`（`admin` 組遷移）
- design 依 A1、B1、C1、D1（不快取）、E1；`AccessCondition` 預留依作用角色的條件型別（Q4）但不實作遮蔽
- tasks 必含：`app/core/permissions.py`、`app/core/authz.py`、`admin` 模組與兩張表的 model 與 migration（`[@dba]`）、`admin` service 實作 `PermissionMatrixProvider`、`app/main.py` 組裝、第 3 步每種拒絕與第 4 步每種條件的負向測試、`GroundTruthBarrier` 實測、`api-envelope` 錯誤碼對照、`error-codes.mdx` 與 `endpoint-authorization.mdx`、`backend-modules.mdx` 的 `admin` 節與相關各節、`architecture.mdx` §待決 第 2 列結案、覆蓋率門檻清單加入 `app/core/authz.py`、`app/core/permissions.py`、`app/modules/admin/service.py`
- 常駐文件依各角色檔的「常駐文件寫法約束」
- Q4 的規格回寫不在本 change；在 #773、#777 追蹤
