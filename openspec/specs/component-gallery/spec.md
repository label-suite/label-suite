# component-gallery Specification

## Purpose

定義開發用的元件展示頁 `/dev/gallery`：每個共用原語宣告的每個 variant、尺寸與狀態都在頁面上出現一次，完整性測試在宣告與展示不一致時失敗；頁面另提供淺色與深色切換與 Token 對照，讓開發者在一頁檢查共用元件與視覺基準。

## Requirements

### Requirement: 原語宣告的 variant 集合固定

共用原語 SHALL 宣告下列可列舉的 variant 集合，並讓測試在執行期讀得到：Button 的 variant 為 `default`、`cta`、`outline`、`secondary`、`ghost`、`destructive`（不含 `link`），尺寸為 `sm`、`md`、`lg`；Badge 為 `success`、`warning`、`error`、`info`、`neutral`、`role`（`role` 是系統角色的藥丸樣式）；Alert 為 `info`、`success`、`warning`、`error`。

來源：ADR-005 D3；frontend-agent-rules F5、F6；clarification Q9、Q10；畫面 artifact 第 4 版 Gallery.dc.html §Button、§Badge、§Alert；`design/system/` Badge `.badge-role`；login-auth-guard PL7、落點確認。

#### Scenario: Button 不宣告 link variant

- **WHEN** 讀取 Button 宣告的 variant 集合
- **THEN** 集合正好是 `default`、`cta`、`outline`、`secondary`、`ghost`、`destructive` 六個，不含 `link`

#### Scenario: Badge 與 Alert 的 variant 集合

- **WHEN** 讀取 Badge 與 Alert 宣告的 variant 集合
- **THEN** Badge 正好是 `success`、`warning`、`error`、`info`、`neutral`、`role`；Alert 正好是 `info`、`success`、`warning`、`error`

### Requirement: 展示頁列出每個宣告的項目

元件展示頁 SHALL 依序以 Button、Input、Label、Badge、Alert、Card、Separator、Dialog、Skeleton · Empty、Token 對照十個區塊展示；原語宣告的每一個 variant、尺寸，以及 Button 的 `disabled`、`loading` 與 Input 的預設、驗證錯誤、停用狀態，各在頁面上出現一次，且可被測試辨識為「元件、維度、值」。Dialog 區塊有一個開啟範例對話框的按鈕。每個區塊標頭的計數 SHALL 由宣告的集合算出。`components/ui/` 的每一個原語都 MUST 出現在展示頁。

來源：ADR-005 D3；frontend-agent-rules F5；clarification Q9、Q19（UI-4）；畫面 artifact 第 4 版 Gallery.dc.html；login-auth-guard PL7、`ui-design.md` §元件樹 › 登入頁；sidebar-nav `ui-design.md` §元件樹（快捷鍵總覽的對話框原語）。

#### Scenario: 每個宣告的 variant 都在頁面上

- **WHEN** 介面語言為 `zh-TW`，渲染元件展示頁
- **THEN** Button 六個 variant、三個尺寸、`disabled` 與 `loading`，Badge 六個 variant，Alert 四個 variant，Input 三個狀態，都各有一個可辨識的展示項目，可見文字就是值的名稱
- **AND** Button 區塊標頭顯示「variant × 6 · size × 3 · 狀態 × 2」，Badge 區塊顯示「variant × 6」，Alert 區塊顯示「variant × 4」，Input 區塊顯示「狀態 × 3」

#### Scenario: 新原語各有一個區塊

- **WHEN** 渲染元件展示頁
- **THEN** 頁面有 Label、Separator 與 Dialog 三個區塊，區塊順序依序為 Button、Input、Label、Badge、Alert、Card、Separator、Dialog、Skeleton · Empty、Token 對照
- **AND** 按下 Dialog 區塊的開啟按鈕後出現一個對話框，按 `Esc` 關閉後焦點回到該按鈕

#### Scenario: 元件展示頁的完整性測試擋下漏寫的variant

- **WHEN** Button 的宣告多了一個 variant，但展示頁沒有對應的展示項目，執行完整性測試
- **THEN** 測試失敗，失敗訊息指出 Button 缺少的 variant 名稱

#### Scenario: 新增原語卻沒放進展示頁時測試失敗

- **WHEN** `components/ui/` 新增一個原語檔案，展示頁沒有對應的區塊，執行完整性測試
- **THEN** 測試失敗，失敗訊息指出缺少展示的原語檔名

#### Scenario: 原語的測試檔不算原語

- **WHEN** `components/ui/` 中除了原語檔案外還有原語的測試檔，執行完整性測試
- **THEN** 測試只要求原語檔案有對應的區塊，不因測試檔沒有區塊而失敗

#### Scenario: 展示頁不顯示測試示意

- **WHEN** 渲染元件展示頁
- **THEN** 頁面上沒有「完整性測試擋下漏寫的 variant（示意）」區塊

### Requirement: Token 對照與對照層樣式檔一致

元件展示頁的 Token 對照區塊 SHALL 以對照層樣式檔為唯一資料來源，顯示 `--primary ← --color-primary-strong`、`--destructive ← --color-error`、`--background ← --color-surface`、`--input ← --color-border-control` 四組對照與各自的色塊；顯示的對照字串 MUST 與樣式檔的宣告一致。

來源：ADR-005 D4；frontend-agent-rules F6；clarification Q16；畫面 artifact 第 4 版 Gallery.dc.html §Token 對照。

#### Scenario: Token 對照顯示四組對照

- **WHEN** 渲染元件展示頁的 Token 對照區塊
- **THEN** 區塊依序顯示 `--primary ← --color-primary-strong`、`--destructive ← --color-error`、`--background ← --color-surface`、`--input ← --color-border-control`

#### Scenario: 對照字串與樣式檔一致

- **WHEN** 把頁面顯示的四組對照與對照層樣式檔淺色區塊中同名變數的值比對
- **THEN** 四組都一致

### Requirement: 目錄依網址錨點標示目前區塊

元件展示頁的元件目錄 SHALL 是名稱為「元件目錄」的導覽地標，含七個指向各區塊的錨點連結；網址錨點對應的連結 SHALL 帶 `aria-current`，其他連結不帶。視窗寬度 767px 以下時目錄位於內容上方。

來源：frontend-agent-rules F4、F9；clarification Q19（UI-6）；畫面 artifact 第 4 版 Gallery.dc.html §元件目錄。

#### Scenario: 開啟帶錨點的網址時目錄標示該區塊

- **WHEN** 開啟 `/dev/gallery#badge`
- **THEN** 目錄中的「Badge」連結帶 `aria-current`，其餘六個連結不帶

#### Scenario: 窄視窗時目錄在內容上方

- **WHEN** 視窗寬度為 767px，開啟元件展示頁
- **THEN** 元件目錄位於頁面標題「元件展示」的上方

### Requirement: 展示頁的欄位樣本具備無障礙關聯

元件展示頁的 Input 三個樣本 SHALL 都有關聯的標籤；驗證錯誤樣本帶 `aria-invalid="true"` 並關聯到錯誤訊息「這一欄的格式不正確」；停用樣本為原生停用。每個區塊是以區塊標題命名的 `section`。

來源：frontend-agent-rules F9；畫面 artifact 第 4 版 Gallery.dc.html §Input。

#### Scenario: 驗證錯誤樣本關聯錯誤訊息

- **WHEN** 渲染元件展示頁的 Input 區塊
- **THEN** 驗證錯誤欄位的 `aria-invalid` 為 `true`，其無障礙描述為「這一欄的格式不正確」
- **AND** 停用欄位無法輸入

### Requirement: 展示樣本不含測試集答案

元件展示頁的樣本資料 SHALL 是固定的示意文字；頁面 MUST NOT 對後端發出任何請求，因此不含任務、資料集或標準答案。

來源：`AGENTS.md` Hard Rule 6；security-agent-rules S5；`ui-design.md` §測試集答案不外露。

#### Scenario: 展示頁不發出後端請求

- **WHEN** 開啟元件展示頁並在各區塊間切換、切換主題
- **THEN** 整個過程沒有任何對後端的請求

### Requirement: 展示頁的外觀切換沿用外觀偏好

元件展示頁的標題列 SHALL 提供與側欄同一個外觀切換控制項：一顆按鈕、同一時間只指向一個方向，點擊在淺色與深色之間切換，並寫入這台瀏覽器的外觀偏好（與側欄、登入頁讀寫同一份）。開啟展示頁時依外觀偏好呈現，重新整理後維持；離開展示頁 MUST NOT 還原外觀。健康檢查頁不提供此切換，但照外觀偏好呈現。

來源：ADR-005 D4；frontend-agent-rules F4、F9；畫面 artifact 第 4 版 Gallery.dc.html §頁首標題列；規格 07-01 §外觀切換 第 4、5 條、§已確認決議 Q21；clarification Q5。

#### Scenario: 元件展示頁切換淺色與深色

- **WHEN** 外觀偏好為淺色，開啟元件展示頁，按下外觀切換
- **THEN** `<html>` 的 `data-theme` 為 `dark`，外觀切換的可存取名稱為「切換為淺色模式」，標題列只有一個外觀切換控制項
- **AND** 這台瀏覽器的外觀偏好記為深色

#### Scenario: 重新整理後沿用外觀偏好

- **WHEN** 在元件展示頁切到深色後重新整理頁面
- **THEN** `<html>` 的 `data-theme` 為 `dark`，外觀切換的可存取名稱為「切換為淺色模式」

#### Scenario: 離開展示頁不還原外觀

- **WHEN** 在元件展示頁切到深色後，於同一個分頁導向 `/dev/health`
- **THEN** `<html>` 的 `data-theme` 為 `dark`，健康檢查頁沒有外觀切換控制項

#### Scenario: 鍵盤可以切換主題

- **WHEN** 外觀偏好為淺色，以 Tab 聚焦到外觀切換並按 Space
- **THEN** `<html>` 的 `data-theme` 為 `dark`
