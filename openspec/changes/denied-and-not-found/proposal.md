# Proposal

## Why

規格 07-03 已定案，要求全站的「找不到」與「無權限」用同一個骨架：標題、說明、恰好一個寫出去處的返回操作，取代內容區、不在空白清單上加一行字，兩種畫面不得互換。目前 `main` 上沒有這個骨架，接下來的任務詳情（#763）、標記清單（#773）、工作頁籤（#725）、通知（#740）都要沿用它；Epic #713 把它排在側欄（#720，已合併）之後、儀表板外殼（#722，blocked-by 本單）之前。Issue #721 的範圍是「無權限與找不到兩種畫面，以及導回儀表板的出口」，畫面已在 2026-11-27 過 Ready gate（核可的對象是 prototype 兩頁裡的兩組狀態，見 `ui-design.md` §Prototype 對照）。

現況的限制決定了這張單能交付到哪裡：正式環境還沒有任何端點掛 `require_permission`，所以 `403 PERMISSION_DENIED` 與授權產生的 `404` 都沒有正式的觸發點（`system-design.md` §設計結論、P-1）；也沒有任何頁面定址到「那一筆」（`system-analysis.md` §跨模組依賴）。本單範圍內 9 條 Scenario 要在哪一層驗、要不要多一個通用入口，取決於下方 §待決問題 的 sa-1、sa-2。

## What Changes

**一定會做（不受待決問題影響）**

- 新增共用的整頁畫面 `BlockedScreen`（放 `frontend/src/components/`）：種類二選一（找不到、無權限），兩種外觀相同、差別只在字面；標題、說明、恰好一個寫出去處的返回連結，沒有送出、儲存、重試或圖示；取代內容區（`ui-design.md` §元件樹、規格 07-03 §畫面的組成 第 1～6 條）
- 找不到有兩種說明：帶識別碼、與「未指定」；無權限的說明提到可以找誰（07-03 §找不到的畫面 第 1、2 條、§無權限的畫面 第 1 條）
- 識別碼只取自網址、只顯示本身，當純文字輸出、雙向隔離、任意字元處換行，不截斷不改寫；畫面不顯示那一筆的任何內容（07-03 §資料欄位、§邊界情況；Hard Rule 6、9）
- 字面、去處、識別碼由使用它的頁面傳入，元件不送任何請求、沒有自己的文案（07-03 §畫面的組成 第一則註）
- 到達時焦點移到標題（不用 `role="alert"`，見 U3）；三種系統角色看到同一套結構
- 後端、API、資料模型、錯誤碼、端點授權**全部不變**（`system-design.md` §設計結論、`api-contract.md`「本次無 API 變更」）；沒有 **BREAKING** 變更
- 常駐文件 `docs/diagrams/architecture/frontend-routes.mdx` §目錄與 §決策紀錄 已先改好（加 `BlockedScreen`）

**取決於待決問題（clarification 決議後才確定）**

- sa-2 選 B 或 C：登入後的未知路徑改顯示通用的找不到頁 `NotFoundPage`（畫在外殼內、返回儀表板、設瀏覽器標題）；B 另為側欄還沒做的六個落點各註冊一條暫時導回 `/`。sa-2 選 A：未知路徑維持經 `/` 導向，三處「07-03 完成時取代」的預告改成不取代
- sa-4（只在 sa-2 選 B、C 時成立）：通用找不到頁的側欄目前位置
- sa-5 選 B：在 `ApiError` 旁加共用的分類（依 `kind`、`status` 與 `code` 分出無權限、找不到、其他；`CSRF_FAILED` 不算無權限，見 SD-2）
- U5：元件展示頁要不要加「無權限與找不到」一節
- U2：`design/system/design-gaps.md` 要不要登記容器不一致與缺元件規格

## Capabilities

### New Capabilities

- `denied-and-not-found-screens`：無權限與找不到兩種整頁畫面的共同結構、兩種說明、識別碼的呈現、唯一返回操作、取代內容區、不得互換、三種系統角色同一套結構，以及不揭露那一筆內容的規則。對應規格 07-03 §驗收標準 本單範圍內的 9 條（範圍盤點見 `system-analysis.md` §驗收標準的範圍盤點）；第 9、10 條移交 #763、#730。這些 Requirement 的驗證層（元件層或端到端）依 sa-1 決議；Scenario 4、6、7（判斷層）是否留在本 capability 依 sa-5 決議

### Modified Capabilities

是否成立都取決於待決問題，決議後由 specs 階段依結果增刪：

| capability                 | 成立條件                          | 要改的 Requirement                                                                                                            |
| :------------------------- | :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `auth-guard`               | sa-2 任一案                       | 「根路徑與不存在的路徑依登入狀態導向」：B、C 改成登入後顯示找不到、未登入仍回登入頁；A 只改來源註，拿掉「之後以找不到頁取代」 |
| `frontend-routing`         | sa-2 選 B 或 C                    | 「開發頁只在開發模式註冊且不經過守門」的未知路徑行為；「每頁設定瀏覽器標題」加通用找不到頁                                    |
| `app-shell-sidebar`        | sa-2 選 B 或 C，且 sa-4 選 A      | 「每頁只有一個目前位置」放寬給通用找不到頁；sa-4 選 B 時不改 Requirement、只多一條路由宣告；選 C 要看 design 是否改到外殼行為 |
| `frontend-api-client`      | sa-5 選 B                         | 新增「拒絕回應的分類」Requirement，與既有「認證錯誤只認 401」並列                                                             |
| `component-gallery`        | U5 選 A 且 sa-2 選 A，或 U5 選 C  | 「元件展示頁 SHALL 依序以……十個區塊展示」改十一個區塊；元件目錄錨點數同步                                                     |
| `permission-authorization` | SD-1／U4 選 B 或 C 且決定在本單做 | 「任務範圍的操作要有生效中的任務成員身分」對停用成員改回 `403` 或新專屬碼；屬 **BREAKING**。sd、ui-ux 都建議交 #763，本單不改 |

## Impact

- **前端**：`frontend/src/components/blocked-screen.tsx`（新建，沿用 `components/ui/card.tsx`、`button.tsx`，U1 推薦 Card）與元件測試；sa-2 B／C 時加 `frontend/src/pages/not-found/`、改 `frontend/src/app/router.tsx` 與 `appShell` 語言檔；sa-5 B 時改 `frontend/src/api/api-error.ts`；U5 時改元件展示頁
- **後端、API、資料庫**：無。`openapi.json`、生成的前端型別、`error-codes.mdx`、`endpoint-authorization.mdx`、`backend-modules.mdx`、資料表字典與 ER 都不變，沒有 migration
- **常駐文件**：`frontend-routes.mdx` 已改 §目錄、§決策紀錄；§路由「其他路徑」、§頁面與功能元件、§已知限制 待 sa-2，§元件展示頁 待 U5
- **不改**：`docs/specs/`、`docs/specs/00-prd.mdx`、`design/prototype/`（Issue #721 §需求目標；AGENTS.md §What `/sdd` authorizes）。sa-3 若選 B 要改 `docs/specs/07-shared/03-denied-and-not-found.mdx`，須由維護者走 `spec-writing`，不在本單授權內
- **後續單**：#763、#773、#725、#740、#730 沿用 `BlockedScreen` 並各自給字面、去處與觸發；#722 換掉暫時落點後「回儀表板」自然指向真正的儀表板
- **測試集答案**：無新風險。畫面不讀業務資料；後端讀標準答案一律回 `404`，畫成找不到

## 引用的需求來源

- 規格 07-03：§目標、§使用角色、§規格（兩種畫面的分工 第 1～5 條、畫面的組成 第 1～6 條與兩則註、找不到的畫面、無權限的畫面、返回操作的去處 第 1～3 條、資料欄位、不在本頁範圍 第 1～5 條）、§邊界情況、§驗收標準 11 條、§已確認決議 Q1～Q6
- `docs/specs/00-prd.mdx`：§使用者角色 §角色清單、§權限矩陣「07 共用介面」列、§Site Map「無權限與找不到」、§跨模組流程
- `docs/specs/07-shared/index.mdx` §Logic Flow 分段四、分段五；規格 07-01 §目前位置、§進入模組的條件；規格 07-02 §權限或資料失效；規格 03-03 §誰進得來 第 1、4 條；規格 04-01 §路由上下文與回退 第 6、7 條
- 既有 openspec：`auth-guard`、`frontend-routing`、`app-shell-sidebar`、`permission-authorization`、`frontend-api-client`、`api-envelope`、`component-gallery`、`user-management`
- 規則：`frontend-agent-rules` F4、F5、F8、F9；`security-agent-rules`「`403` vs `404`」；AGENTS.md Hard Rule 6、9
- 本 change：`system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`；Issue #721、Epic #713

## 待決問題

本份不替任何一題選邊；下表把四份上游的待決集中，標出每題動到的範圍。「建議」欄照抄上游的建議，不是決議。

| 題號     | 出處                       | 問題                                                                   | 相關題                          | 上游建議                     | 對本單範圍的影響                                                                                                                                                                          |
| :------- | :------------------------- | :--------------------------------------------------------------------- | :------------------------------ | :--------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sa-1     | sa §待決問題 1             | 9 條 Scenario 從哪裡觸發、怎麼驗收（元件層、加通用入口、延到 #763）    | sa-2、U5、SD-2                  | sd：不為驗收另加正式端點     | 決定 `denied-and-not-found-screens` 的驗證層、tasks 有沒有 E2E、`acceptance.md` 的人工步驟開哪裡；選 C 則本單延後，整份 proposal 要重寫                                                   |
| sa-2     | sa §待決問題 2             | 登入後未知路徑要不要改顯示找不到（A 維持、B 改並加六條導回、C 改不加） | sa-4、U5、`frontend-routes.mdx` | 無                           | B、C：新增 `NotFoundPage`，MODIFIED `auth-guard`、`frontend-routing`，可能牽動 `app-shell-sidebar`；C 讓 #720 已驗收的導覽項點了落到找不到。A：只改 `auth-guard` 來源註與常駐文件預告     |
| sa-3     | sa §待決問題 3             | 「回儀表板」的依據與通用字面以什麼為準                                 | sa-2、ui §文案鍵                | 無（ui 只列候選字面）        | 決定通用找不到頁的字面來源；B 要維護者走 `spec-writing` 改 07-03；C 讓 Scenario 1、2、11 只能用測試用去處驗。ui-design 已寫明 Ready gate 核可的是 prototype 兩組狀態、沒有另外的 artifact |
| sa-4     | sa §待決問題 4             | 通用找不到頁的側欄目前位置（不標、標儀表板、沿用上一頁）               | sa-2                            | 無                           | 只在 sa-2 選 B、C 時成立；A 要出 `app-shell-sidebar` delta 並改路由宣告測試；C 要外殼記住上一頁                                                                                           |
| sa-5     | sa §待決問題 5             | 拒絕回應要不要有共用的轉換規則                                         | SD-1、SD-2、U4                  | 無                           | 決定 Scenario 4、6、7（判斷層）留在本單或移交 #763；B 時 MODIFIED `frontend-api-client`                                                                                                   |
| SD-1／U4 | sd §待決問題、ui §待決問題 | 「權限被撤銷」對到哪一種回應；停用的成員身分現在回 `404`               | sa-5                            | sd、ui：A，交 #763 定案      | 選 A 本單零後端異動；選 B、C 且在本單做則 MODIFIED `permission-authorization`、改 `error-codes.mdx`，屬 **BREAKING**                                                                      |
| SD-2     | sd §待決問題               | 共用對應只做分類，或自動換成整頁                                       | sa-5                            | sd：A（只分類，依 `code`）   | 只在 sa-5 選 B 時成立；B 會與規格 03-03 §誰進得來 第 1 條、07-03 §不在本頁範圍 第 4 條衝突                                                                                                |
| SD-3     | sd §待決問題               | 識別碼過長被 nginx 先回 `414`／`400` 怎麼處理                          | —                               | sd：A，交 #763／#773         | 本單只需畫面能接受任意長度並當純文字畫出；不改 `frontend/nginx.conf`                                                                                                                      |
| U1       | ui §待決問題               | 兩個 prototype 的容器不同（Card 或 Empty State）                       | U2                              | ui：A，以 Card 為準          | 決定 `BlockedScreen` 沿用哪個原語與 token 表；B 要改 `components/ui/empty.tsx` 的固定圖示與展示頁；牽動 #763、#773 的畫面核對                                                             |
| U2       | ui §待決問題               | 設計系統沒有這個元件的規格                                             | U1                              | ui：A，登記 `design-gaps.md` | A、B 讓 tasks 多一項 `[@technical-writer]` 文件工作；B 另要過 `check-component-reuse.mjs`                                                                                                 |
| U3       | ui §待決問題               | 朗讀方式：到達時移焦點，或照 prototype 用 `role="alert"`               | —                               | ui：A，移焦點                | 只影響 `BlockedScreen` 的無障礙屬性與元件測試                                                                                                                                             |
| U5       | ui §待決問題               | 元件展示頁要不要加一節                                                 | sa-1、sa-2                      | ui：A，只在 sa-2 選 A 時加   | 加的話 MODIFIED `component-gallery`、改 `frontend-routes.mdx` §元件展示頁，並成為 `acceptance.md` 人工步驟的入口                                                                          |

另有一項明確問題（P），不屬於上表：sd P-1 指出 `system-analysis.md` §跨模組依賴 第 3 列與 §待決問題 1 寫「目前只有系統管理的帳號讀取會回拒絕」與現況不符（正式環境沒有任何端點掛 `require_permission`）。本份依 sd 的更正撰寫；`system-analysis.md` 尚未回修，交原撰寫角色 sa。
