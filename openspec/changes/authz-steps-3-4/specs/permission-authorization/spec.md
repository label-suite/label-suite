# Spec Delta

## Purpose

定義授權四段在第 1、2 段（`auth-guard`）之後的共用判斷：任務範圍操作的任務成員身分、操作對到權限矩陣中已啟用的權限鍵與對應角色的格、格通過後的附加條件與答案隔離，以及每一種拒絕回什麼、錯誤外層不外露什麼，讓之後每個模組的受保護操作都依同一套規則放行或拒絕。

## ADDED Requirements

### Requirement: 授權依固定順序判斷，任一步不通過就停

需要權限的操作 SHALL 依序判斷：第 1、2 段的帳號與系統角色、任務範圍操作的任務成員身分、權限鍵與矩陣格、附加條件；任一步不通過即拒絕，不再判斷後面的步驟，也沒有「預設允許」。格通過不等於能碰那一筆資料。

來源：規格 06-02 §授權判斷的順序 第 1–7 條；security-agent-rules S3；ADR-004 D6；clarification Q1。

#### Scenario: 沒有成員身分時先回找不到

- **WHEN** 一位在任務 T 沒有任何成員身分的平台成員，呼叫一個需要任務層鍵 `task.detail.edit` 的任務 T 範圍操作
- **THEN** 系統回覆 `404`、`code` 為 `"NOT_FOUND"`，不是 `403`

#### Scenario: 格為關時不再檢查附加條件

- **WHEN** 任務 T 的審核員（`task.detail.edit` 的格為關）呼叫一個需要 `task.detail.edit`、同時宣告了「看不到就回找不到」附加條件的任務 T 範圍操作
- **THEN** 系統回覆 `403`、`code` 為 `"PERMISSION_DENIED"`，附加條件沒有被執行

### Requirement: 平台層操作依系統角色那一格判斷

需要平台層鍵的操作 SHALL 以這一次從資料庫讀到的系統角色（`user` 或 `super_admin`；Seeder 管理員是 `super_admin`）查那一格：格為開才放行，格為關回 `403 PERMISSION_DENIED`。系統角色 MUST 每次從資料庫讀，不沿用憑證內的值。

來源：規格 06-02 §授權判斷的順序 第 3 條、§預設矩陣 第 1 條、§固定格不能改；ADR-004 D2、D6；security-agent-rules S3；clarification Q3。

#### Scenario: 平台層操作依系統角色那一格判斷

- **WHEN** 矩陣為初始狀態，平台成員與系統管理員各呼叫一次需要 `task.list.view` 的操作，以及需要 `admin.user_management.view` 的操作
- **THEN** 兩人呼叫 `task.list.view` 都成功；`admin.user_management.view` 由系統管理員呼叫時成功，由平台成員呼叫時回 `403`、`code` 為 `"PERMISSION_DENIED"`

#### Scenario: Seeder 管理員依系統管理員那一欄判斷

- **WHEN** Seeder 管理員呼叫需要 `admin.role_settings.manage` 的操作
- **THEN** 操作成功

#### Scenario: 系統角色降級後下一次操作就被拒

- **WHEN** 系統管理員呼叫需要 `admin.user_management.view` 的操作成功後，他的系統角色在資料庫改為 `user`，他以同一組登入 cookie 再呼叫一次
- **THEN** 第二次回 `403`、`code` 為 `"PERMISSION_DENIED"`

### Requirement: 認不得的鍵與待啟用的鍵一律拒絕

操作對到的權限鍵不在白名單內，或在白名單內但尚未啟用時，系統 SHALL 一律回 `403 PERMISSION_DENIED`，即使矩陣裡那個鍵對應角色的格為開。尚未啟用的鍵是 `admin.platform_overview.view`、`task.lifecycle.manage`、`task.delete`、`annotation.exception.resolve`、`annotation.dispute.adjudicate`。

來源：規格 06-02 §五個已登錄、待啟用的鍵 第 1–5 條、§授權判斷的順序 第 5 條；ADR-004 D6；clarification P4。

#### Scenario: 認不得的鍵被拒絕

- **WHEN** 系統管理員呼叫一個宣告需要白名單外的鍵 `admin.unknown.view` 的操作
- **THEN** 系統回覆 `403`、`code` 為 `"PERMISSION_DENIED"`

#### Scenario: 待啟用的鍵按認不得的鍵拒絕

- **WHEN** 系統管理員呼叫需要 `admin.platform_overview.view` 的操作（矩陣中系統管理員那一格為開），以及任務 T 的專案負責人呼叫需要 `task.delete` 的任務 T 範圍操作（矩陣中專案負責人那一格為開）
- **THEN** 兩次都回 `403`、`code` 為 `"PERMISSION_DENIED"`，與認不得的鍵是同一個回應

### Requirement: 鍵的層級要與操作的範圍相符

平台層的鍵只能用在不屬於任何任務的操作，任務層的鍵只能用在任務範圍的操作；層級不符時系統 SHALL 回 `403 PERMISSION_DENIED`。系統角色 MUST NOT 拿到任務層的鍵，任務角色 MUST NOT 拿到平台層的鍵。

來源：規格 06-02 §適用格，錯層的不存 第 3 條、§授權判斷的順序 第 5 條；PRD §權限矩陣 表下第 2 條。

#### Scenario: 任務層的鍵用在非任務範圍的操作

- **WHEN** 系統管理員呼叫一個不屬於任何任務、卻宣告需要任務層鍵 `task.detail.view` 的操作
- **THEN** 系統回覆 `403`、`code` 為 `"PERMISSION_DENIED"`

#### Scenario: 平台層的鍵用在任務範圍的操作

- **WHEN** 任務 T 的專案負責人呼叫一個任務 T 範圍、卻宣告需要平台層鍵 `task.create` 的操作
- **THEN** 系統回覆 `403`、`code` 為 `"PERMISSION_DENIED"`

### Requirement: 矩陣版本不存在或用到的格缺列就拒絕

判斷時讀不到矩陣版本，或這一次用到的任一生效角色的格不存在，系統 SHALL 回 `403 PERMISSION_DENIED`；缺列 MUST NOT 被當成「關」以外的值，也 MUST NOT 以預設值補上。判斷只看這一次用到的格：其他格缺列或矩陣裡有認不得的鍵的列，不影響這一次的結果。

來源：規格 06-02 §適用格 第 6 條、§授權判斷的順序 第 5 條；ADR-004 D6；security-agent-rules S3；clarification P3。

#### Scenario: 版本不存在時一律拒絕

- **WHEN** 矩陣版本的那一列被刪除後，系統管理員呼叫需要 `dashboard.view` 的操作
- **THEN** 系統回覆 `403`、`code` 為 `"PERMISSION_DENIED"`

#### Scenario: 用到的格缺列時拒絕

- **WHEN** 平台成員 × `task.create` 那一列被刪除後，平台成員與系統管理員各呼叫一次需要 `task.create` 的操作
- **THEN** 平台成員那一次回 `403`、`code` 為 `"PERMISSION_DENIED"`；系統管理員那一次成功

#### Scenario: 認不得的鍵的列不影響其他判斷

- **WHEN** 矩陣多了一列白名單外的鍵 `legacy.removed.view`（平台成員、開），平台成員呼叫需要 `task.list.view` 的操作
- **THEN** 操作成功

### Requirement: 矩陣更新後下一次判斷就依新值

授權判斷 SHALL 每一次都讀當下的矩陣，矩陣的格被改過之後，下一次判斷 MUST 依新值，不沿用之前的結果。

來源：ADR-004 D6「第一版不快取」；security-agent-rules S3、S4；PRD §模組依賴「06 修改角色權限 → 03、04、05 依新權限擋下操作」；clarification P10。

#### Scenario: 關掉一格後下一次操作被拒

- **WHEN** 平台成員呼叫需要 `task.create` 的操作成功後，平台成員 × `task.create` 的格在資料庫改為關，他再呼叫一次
- **THEN** 第二次回 `403`、`code` 為 `"PERMISSION_DENIED"`

### Requirement: 任務範圍的操作要有生效中的任務成員身分

任務範圍的操作 SHALL 每次從資料讀呼叫者在該任務生效中的任務角色；不是成員、成員身分已停用或仍在邀請中時，一個任務層的鍵都拿不到，回 `404 NOT_FOUND`，與任務不存在同一個回應。系統角色 MUST NOT 隱含任何任務角色。

來源：規格 06-02 §授權判斷的順序 第 2、5、6 條、§兩層授權模型 第 2 條；PRD §權限矩陣 表下第 2 條；security-agent-rules S3、S10；clarification Q1、Q3。

#### Scenario: 失效的成員身分被拒絕

- **WHEN** 任務 T 的三位使用者——成員身分已停用的、仍在邀請中的，以及從未是成員的——各呼叫需要 `task.detail.view` 的任務 T 範圍操作
- **THEN** 三次都回 `404`、`code` 為 `"NOT_FOUND"`，`message` 與呼叫一個不存在的任務時相同

#### Scenario: 系統管理員沒有任務角色時拿不到任務層的鍵

- **WHEN** 在任務 T 沒有任何成員身分的系統管理員呼叫需要 `task.detail.view` 的任務 T 範圍操作
- **THEN** 系統回覆 `404`、`code` 為 `"NOT_FOUND"`

#### Scenario: 換成另一個任務被拒絕

- **WHEN** 任務 T 的專案負責人把同一個操作的任務換成他不是成員的任務 U
- **THEN** 對任務 T 的呼叫成功，對任務 U 的呼叫回 `404`、`code` 為 `"NOT_FOUND"`

#### Scenario: 任務識別碼格式不對時當成找不到

- **WHEN** 已登入的專案負責人以不是 UUID 的任務識別碼 `not-a-uuid` 呼叫需要 `task.detail.view` 的任務範圍操作
- **THEN** 系統回覆 `404`、`code` 為 `"NOT_FOUND"`，不是 `422`

### Requirement: 任務頁面取生效角色的允許聯集

一人在同一任務有多個生效的任務角色、操作沒有指定作用角色時，系統 SHALL 以這些角色的允許聯集判斷：任一生效角色的格為開即通過第 3 段；任一生效角色的格缺列即拒絕。聯集只放寬「有沒有這個權限」，附加條件仍要逐一通過。

來源：規格 06-02 §一人多任務角色 第 1–3 條、§已確認決議 Q8；clarification P6。

#### Scenario: 任務頁面取聯集

- **WHEN** 某人在任務 T 同時是審核員與標記員（`task.detail.view` 的格審核員開、標記員關），呼叫需要 `task.detail.view` 的任務 T 範圍操作
- **THEN** 操作成功

#### Scenario: 聯集裡每個角色的格都關時拒絕

- **WHEN** 同一人呼叫需要 `task.detail.edit` 的任務 T 範圍操作（審核員與標記員的格都關）
- **THEN** 系統回覆 `403`、`code` 為 `"PERMISSION_DENIED"`

### Requirement: 指定作用角色時只依那一個角色判斷

操作指定了作用角色時，系統 SHALL 只依那一個角色的格判斷，不因呼叫者的其他任務角色而放寬；作用角色不是呼叫者在該任務生效中的角色時，回 `404 NOT_FOUND`。請求帶來的角色或人員參數 MUST NOT 建立任何身分。

來源：規格 06-02 §一人多任務角色 第 4–7 條、§已確認決議 Q8；規格 04-02；clarification P6、Q3。

#### Scenario: 工作區只依作用角色

- **WHEN** 某人在任務 T 同時是專案負責人與審核員，以作用角色 `reviewer` 呼叫需要 `task.detail.edit` 的任務 T 範圍操作（專案負責人那一格開、審核員那一格關），以及以作用角色 `reviewer` 呼叫需要 `annotation.review` 的操作（審核員那一格開）
- **THEN** 前者回 `403`、`code` 為 `"PERMISSION_DENIED"`，沒有因為專案負責人那一格為開而放寬；後者成功

#### Scenario: 作用角色比聯集嚴格

- **WHEN** 同一人不指定作用角色呼叫需要 `task.detail.edit` 的任務 T 範圍操作，再以作用角色 `reviewer` 呼叫同一個操作
- **THEN** 不指定時取聯集而成功；指定 `reviewer` 時回 `403`、`code` 為 `"PERMISSION_DENIED"`

#### Scenario: 網址參數不能建立身分

- **WHEN** 只是任務 T 審核員的人，以作用角色 `annotator` 呼叫需要 `annotation.annotate` 的任務 T 範圍操作
- **THEN** 系統回覆 `404`、`code` 為 `"NOT_FOUND"`

### Requirement: 授權要過資源條件

格通過之後，系統 SHALL 依序檢查操作宣告的每一個附加條件，任何一個不通過就拒絕，即使格為開。附加條件的種類有任務歸屬、任務狀態、指派、審核者身分、資料集可見性、答案隔離與作用角色；遇到看不到的資源回 `404 NOT_FOUND`，看得到但狀態不允許時回該條件自己定義的錯誤。

來源：規格 06-02 §授權判斷的順序 第 4、7 條、§一人多任務角色 第 3 條；security-agent-rules S3、S10；ADR-004 D6；issue #755 驗收條件第 3 列；clarification Q1、Q4。

#### Scenario: 授權要過資源條件

- **WHEN** 任務 T 的專案負責人（`task.detail.view` 的格為開）呼叫一個需要 `task.detail.view`、宣告了任務歸屬條件的操作，而那筆資料不屬於他能看到的範圍
- **THEN** 系統回覆 `404`、`code` 為 `"NOT_FOUND"`

#### Scenario: 每一種附加條件不通過時都拒絕

- **WHEN** 格為開的呼叫者，分別呼叫只宣告任務歸屬、任務狀態、指派、審核者身分、資料集可見性、作用角色其中一種條件、且該條件不通過的操作
- **THEN** 六次都被拒絕：看不到的資源回 `404`、`code` 為 `"NOT_FOUND"`；狀態不允許時回該條件定義的錯誤碼；沒有一次成功

#### Scenario: 附加條件全部通過才放行

- **WHEN** 格為開的呼叫者，呼叫一個宣告了兩個條件、兩個都通過的操作
- **THEN** 操作成功

### Requirement: 標準答案不經任何角色放行

宣告會讀標準答案的操作，系統 SHALL 對任何登入的人一律回 `404 NOT_FOUND`，與資源不存在同一個回應；沒有任何系統角色、任務角色或矩陣設定能讓它放行，回應 MUST NOT 含標準答案或透露那裡有答案。

來源：PRD §不是角色的讀取對象；AGENTS.md Hard Rule 6；security-agent-rules S5、S6；規格 06-02 §授權判斷的順序 第 4 條；clarification Q1。

#### Scenario: 標準答案不經任何角色放行

- **WHEN** 四位在任務 T 都有生效成員身分的呼叫者——同時是任務 T 專案負責人的系統管理員、專案負責人、審核員與標記員（標記員 × `task.detail.view` 的格先改為開，四人的生效角色對 `task.detail.view` 都為開）——各呼叫一個需要 `task.detail.view`、宣告會讀任務 T 標準答案的任務 T 範圍操作，再各呼叫一個需要同一個鍵、但沒有宣告讀標準答案的任務 T 範圍操作
- **THEN** 後者四次都成功，表示四人都通過了成員身分與矩陣格兩段；前者四次都回 `404`、`code` 為 `"NOT_FOUND"`，`message` 與呼叫一個不存在的資源時相同，這個 `404` 來自答案隔離
- **AND** 前者四個回應 body 的 `data` 都為 `null`，序列化後不含任何標準答案的值，也不含 `answer`、`groundTruth`、`isTestItem` 字樣

### Requirement: 授權拒絕的回應不外露內部資訊

`403 PERMISSION_DENIED` 的錯誤外層 SHALL 只帶固定的一句本地化 `message`，`data` 與 `errors` 為 `null`；`403` 與授權產生的 `404` 都 MUST NOT 帶權限鍵、角色、任務識別碼、矩陣版本或拒絕在哪一步，也 MUST NOT 設定或清除任何 cookie。

來源：`api-contract.md` §錯誤契約：PERMISSION_DENIED；api-agent-rules A7；security-agent-rules S10；`openspec/config.yaml` rules.api-contract。

#### Scenario: 權限不足的錯誤外層

- **WHEN** 平台成員以 `Accept-Language: zh-TW` 呼叫需要 `admin.user_management.view` 的操作
- **THEN** 系統回覆 `403`，body 的頂層欄位恰好是 `success`、`code`、`message`、`data`、`timestamp`、`traceId`、`errors` 七個；`success` 為 `false`、`code` 為 `"PERMISSION_DENIED"`、`message` 等於 `"你沒有執行這個操作的權限"`、`data` 為 `null`、`errors` 為 `null`
- **AND** body 序列化後不含 `admin.user_management.view` 與 `super_admin`，回應沒有 `Set-Cookie` 標頭

#### Scenario: 權限不足的英文訊息

- **WHEN** 同一個呼叫改帶 `Accept-Language: en`
- **THEN** `message` 為 `"You do not have permission to perform this action."`

#### Scenario: 每一種第 3 段拒絕都是同一個回應

- **WHEN** 平台成員分別呼叫需要認不得的鍵、待啟用的鍵、錯層的鍵（任務層鍵 `task.detail.view` 用在不屬於任何任務的操作）、格為關的鍵的操作
- **THEN** 四個回應的狀態、`code` 與 `message` 都相同
