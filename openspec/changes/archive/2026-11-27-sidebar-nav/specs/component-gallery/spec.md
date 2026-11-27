# Spec Delta

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: 展示頁切換淺色與深色

**Reason**：外觀切換改成共用元件，展示頁與側欄讀寫同一份外觀偏好；原本「不寫入儲存、重新整理回到淺色、離開展示頁還原淺色」會蓋掉使用者在側欄選的外觀（規格 07-01 §外觀切換 第 5 條、§已確認決議 Q21；clarification Q5）。

**Migration**：改由本 delta ADDED 的「展示頁的外觀切換沿用外觀偏好」規範；外觀偏好的保存與解讀見 `appearance-mode`。

## ADDED Requirements

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
