# Proposal

## Why

規格 07-03 已定案，要求全站的「找不到」與「無權限」用同一個骨架：標題、說明、恰好一個寫出去處的返回操作，取代內容區、不在空白清單上加一行字，兩種畫面不得互換。目前 `main` 上沒有這個骨架，接下來的任務詳情（#763）、標記清單（#773）、工作頁籤（#725）、通知（#740）都要沿用它；Epic #713 把它排在側欄（#720，已合併）之後、儀表板外殼（#722，blocked-by 本單）之前。Issue #721 的範圍是「無權限與找不到兩種畫面，以及導回儀表板的出口」，畫面已在 2026-11-27 過 Ready gate（核可的對象是 prototype 兩頁裡的兩組狀態，見 `ui-design.md` §Prototype 對照）。

現況的限制決定了這張單能交付到哪裡：正式環境還沒有任何端點掛 `require_permission`，所以 `403 PERMISSION_DENIED` 與授權產生的 `404` 都沒有正式的觸發點（`system-design.md` §設計結論）；也沒有任何頁面定址到「那一筆」（`system-analysis.md` §跨模組依賴）。所以本單只做共用骨架與分類規則，9 條 Scenario 以 unit 與元件展示頁上的 e2e 驗，以真實頁面觸發的端對端驗證由 #763、#773 補上（clarification Q1）。

## What Changes

- 新增共用的整頁畫面 `BlockedScreen`（放 `frontend/src/components/`）：種類二選一（找不到、無權限），兩種外觀相同、差別只在字面；標題、說明、恰好一個寫出去處的返回連結，沒有送出、儲存、重試或圖示；取代內容區；容器以任務詳情 prototype 的 Card 為準（`ui-design.md` §元件樹；規格 07-03 §畫面的組成 第 1～6 條；clarification Q7）
- 字面、去處與識別碼都由使用它的頁面傳入，元件不送任何請求、沒有自己的文案、不預設儀表板（07-03 §畫面的組成 第一則註；clarification Q3）
- 識別碼只取自網址、只顯示本身，當純文字輸出、雙向隔離、任意字元處換行，不截斷不改寫；畫面不顯示那一筆的任何內容（07-03 §資料欄位、§邊界情況；Hard Rule 6、9；clarification Q6）
- 到達時焦點移到標題，不用 `role="alert"`；三種系統角色看到同一套結構（clarification Q7）
- 在 `frontend/src/api/api-error.ts` 新增拒絕回應的分類：依 `kind`、`status` 與 `code` 分出無權限（`403 PERMISSION_DENIED`）、找不到（`404 NOT_FOUND`）與其他（含 `403 CSRF_FAILED`）；只分類，要不要畫成整頁、去處在哪由擁有那一頁的模組決定（clarification Q4）
- 元件展示頁新增一節「無權限與找不到」，展示找不到、無權限與識別碼很長三個樣本，去處是儀表板、字面取 07-03 的示例句；這一節是本單 e2e 與人工抽查的入口，也落實 Issue #721 的「導回儀表板的出口」（clarification Q1、Q3、Q8）
- 未註冊的網址**維持**導回暫時落點，不做通用找不到頁；`auth-guard` 只改來源註（clarification Q2）
- 後端、API、資料模型、錯誤碼、端點授權**全部不變**（`system-design.md` §設計結論、`api-contract.md`「本次無 API 變更」）；沒有 **BREAKING** 變更
- 常駐文件 `docs/diagrams/architecture/frontend-routes.mdx` 與 `design/system/design-gaps.md`（G-67 容器不一致、G-68 缺元件規格）已在規劃階段改好（clarification P2、Q7、Q8）

## Capabilities

### New Capabilities

- `denied-and-not-found-screens`：無權限與找不到兩種整頁畫面的共同結構、兩種說明（含「未指定」）、識別碼的呈現、唯一返回操作、取代內容區、依分類決定種類且不得互換、三種系統角色同一套結構，以及不揭露那一筆內容的規則。對應規格 07-03 §驗收標準 本單範圍內的 9 條；「邊界：返回之後仍被擋下」移交 #763、「邊界：被權限矩陣帶回的那一頁也擋下他」移交 #730（clarification §移出本次的驗收標準）

### Modified Capabilities

- `auth-guard`：「根路徑與不存在的路徑依登入狀態導向」只改來源註，拿掉「規格 07-03（之後以找不到頁取代）」，改成 07-03 只涵蓋網址定址到的那一筆、未註冊網址維持導向；行為不變（clarification Q2）
- `frontend-api-client`：ADDED「拒絕回應分成無權限、找不到與其他」，與既有「認證錯誤只認 401」並列（clarification Q4）
- `component-gallery`：MODIFIED「展示頁列出每個宣告的項目」（十個區塊變十一個）與「目錄依網址錨點標示目前區塊」（錨點數改十一個，並更正條文原本未同步的「七個」）；ADDED「展示頁展示無權限與找不到的樣本」（clarification Q8）

不改：`frontend-routing`、`app-shell-sidebar`（沒有新路由與通用找不到頁，Q2）、`permission-authorization`（停用成員回 `404` 與 07-03 的不一致交 #763，Q5）。

## Impact

- **前端**：新建 `frontend/src/components/blocked-screen.tsx`（沿用 `components/ui/card.tsx`、`button.tsx`）與測試；改 `frontend/src/api/api-error.ts`；改元件展示頁 `frontend/src/pages/dev-gallery/` 與 `devGallery` 語言檔；新增 `e2e/system-health/dev-gallery.spec.ts`
- **後端、API、資料庫**：無。`openapi.json`、生成的前端型別、`error-codes.mdx`、`endpoint-authorization.mdx`、`backend-modules.mdx`、資料表字典與 ER 都不變，沒有 migration
- **常駐文件**：`frontend-routes.mdx` 已改 §路由「其他路徑」、§目錄、apiFetch 的細節、§元件展示頁、§已知限制、§決策紀錄；實作後由實作角色依實際名稱校正
- **不改**：`docs/specs/`、`docs/specs/00-prd.mdx`、`design/prototype/`（Issue #721 §需求目標；AGENTS.md §What `/sdd` authorizes）
- **後續單**：#763、#773、#725、#740 沿用 `BlockedScreen` 與分類，各自給字面、去處與觸發；#763、#773、#725 的查詢要自己關掉 `refetchOnWindowFocus`（clarification Q9）；#722 換掉暫時落點後「回儀表板」自然指向真正的儀表板
- **測試集答案**：無新風險。畫面不讀業務資料，只顯示網址上的識別碼本身；後端讀標準答案一律回 `404`，畫成找不到

## 引用的需求來源

- 規格 07-03：§目標、§使用角色、§規格（兩種畫面的分工 第 1～5 條、畫面的組成 第 1～6 條與兩則註、找不到的畫面、無權限的畫面、返回操作的去處 第 1～3 條、資料欄位、不在本頁範圍 第 1～5 條）、§邊界情況、§驗收標準 11 條（本單 9 條）、§已確認決議 Q1～Q6
- `docs/specs/00-prd.mdx`：§使用者角色 §角色清單、§權限矩陣「07 共用介面」列、§Site Map「無權限與找不到」、§跨模組流程
- `docs/specs/07-shared/index.mdx` §Logic Flow 分段四、分段五；規格 07-01 §目前位置、§進入模組的條件；規格 07-02 §權限或資料失效；規格 03-03 §誰進得來 第 1、4 條；規格 04-01 §路由上下文與回退 第 6、7 條
- 既有 openspec：`auth-guard`、`frontend-api-client`、`component-gallery`、`permission-authorization`、`api-envelope`
- 規則：`frontend-agent-rules` F4、F5、F8、F9；`api-agent-rules` A7；`security-agent-rules`「`403` vs `404`」；AGENTS.md Hard Rule 6、9
- 本 change：`system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`、`clarification.md`（Q1～Q9、P1～P2）；Issue #721、Epic #713

## 待決問題

上游的 12 題（sa-1～5、SD-1～3、U1～U5）已由 `clarification.md` Q1～Q9 全部決議，本份沒有未決問題。交給接手單的事項：

| 事項                                                                  | 接手                  | 依據                |
| :-------------------------------------------------------------------- | :-------------------- | :------------------ |
| 以真實頁面觸發的端對端驗證                                            | #763、#773            | clarification Q1    |
| 「邊界：返回之後仍被擋下」                                            | #763                  | clarification §移出 |
| 「邊界：被權限矩陣帶回的那一頁也擋下他」                              | #730                  | clarification §移出 |
| 停用的成員身分回 `404`，與 07-03、03-03「權限被撤銷顯示無權限」不一致 | #763 的 clarification | clarification Q5    |
| 顯示這兩種畫面的查詢要關掉 `refetchOnWindowFocus`                     | #763、#773、#725      | clarification Q9    |
| 識別碼送出請求前的格式檢查                                            | #763                  | clarification Q6    |
