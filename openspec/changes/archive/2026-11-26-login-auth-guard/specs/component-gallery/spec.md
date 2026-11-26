# Spec Delta

## MODIFIED Requirements

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

元件展示頁 SHALL 依序以 Button、Input、Label、Badge、Alert、Card、Separator、Skeleton · Empty、Token 對照九個區塊展示；原語宣告的每一個 variant、尺寸，以及 Button 的 `disabled`、`loading` 與 Input 的預設、驗證錯誤、停用狀態，各在頁面上出現一次，且可被測試辨識為「元件、維度、值」。每個區塊標頭的計數 SHALL 由宣告的集合算出。`components/ui/` 的每一個原語都 MUST 出現在展示頁。

來源：ADR-005 D3；frontend-agent-rules F5；clarification Q9、Q19（UI-4）；畫面 artifact 第 4 版 Gallery.dc.html；login-auth-guard PL7、`ui-design.md` §元件樹 › 登入頁。

#### Scenario: 每個宣告的 variant 都在頁面上

- **WHEN** 介面語言為 `zh-TW`，渲染元件展示頁
- **THEN** Button 六個 variant、三個尺寸、`disabled` 與 `loading`，Badge 六個 variant，Alert 四個 variant，Input 三個狀態，都各有一個可辨識的展示項目，可見文字就是值的名稱
- **AND** Button 區塊標頭顯示「variant × 6 · size × 3 · 狀態 × 2」，Badge 區塊顯示「variant × 6」，Alert 區塊顯示「variant × 4」，Input 區塊顯示「狀態 × 3」

#### Scenario: 新原語各有一個區塊

- **WHEN** 渲染元件展示頁
- **THEN** 頁面有 Label 與 Separator 兩個區塊，區塊順序依序為 Button、Input、Label、Badge、Alert、Card、Separator、Skeleton · Empty、Token 對照

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
