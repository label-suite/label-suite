# Spec Delta

## MODIFIED Requirements

### Requirement: 原語宣告的 variant 集合固定

共用原語 SHALL 宣告下列可列舉的 variant 集合，並讓測試在執行期讀得到：Button 的 variant 為 `default`、`cta`、`outline`、`secondary`、`ghost`、`destructive`（不含 `link`），尺寸為 `sm`、`md`、`lg`；Badge 為 `success`、`warning`、`error`、`info`、`neutral`、`role`（`role` 是系統角色的藥丸樣式）；Alert 為 `info`、`success`、`warning`、`error`；Skeleton 的動畫為 `pulse`、`shimmer`，沒有指定時為 `pulse`。

來源：ADR-005 D3；frontend-agent-rules F5、F6、F9；clarification Q9、Q10；畫面 artifact 第 4 版 Gallery.dc.html §Button、§Badge、§Alert；`design/system/` Badge `.badge-role`；`design/system/components/skeleton.md` §變體 A（pulse）、B（shimmer）；login-auth-guard PL7、落點確認；dashboard-shell `ui-design.md` §元件樹「原語的兩處擴充」；規格 02-01 §這一頁顯示哪一種版面 第 9 條。

#### Scenario: Button 不宣告 link variant

- **WHEN** 讀取 Button 宣告的 variant 集合
- **THEN** 集合正好是 `default`、`cta`、`outline`、`secondary`、`ghost`、`destructive` 六個，不含 `link`

#### Scenario: Badge 與 Alert 的 variant 集合

- **WHEN** 讀取 Badge 與 Alert 宣告的 variant 集合
- **THEN** Badge 正好是 `success`、`warning`、`error`、`info`、`neutral`、`role`；Alert 正好是 `info`、`success`、`warning`、`error`

#### Scenario: Skeleton 的動畫集合與預設

- **WHEN** 讀取 Skeleton 宣告的動畫集合，並畫出一個沒有指定動畫的 Skeleton
- **THEN** 集合正好是 `pulse`、`shimmer` 兩個；沒有指定動畫的 Skeleton 以 `pulse` 呈現
- **AND** 兩種動畫的 Skeleton 都對輔助技術隱藏

#### Scenario: 減少動態效果時光帶不播放

- **WHEN** 瀏覽器回報 `prefers-reduced-motion: reduce`，畫出動畫為 `shimmer` 的 Skeleton
- **THEN** 它的計算後動畫時間為 0 或沒有動畫，佔位塊仍看得見

### Requirement: 展示頁列出每個宣告的項目

元件展示頁 SHALL 以十二個區塊展示，區塊與順序見 Scenario「新原語各有一個區塊」；原語宣告的每一個 variant、尺寸，以及 Button 的 `disabled`、`loading`、Input 的預設、驗證錯誤、停用狀態、Skeleton 的兩種動畫與 Metric 的一個樣本，各在頁面上出現一次，且可被測試辨識為「元件、維度、值」。Dialog 區塊有一個開啟範例對話框的按鈕。每個區塊標頭的計數 SHALL 由宣告的集合算出。`components/ui/` 的每一個原語都 MUST 出現在展示頁。

來源：ADR-005 D3；frontend-agent-rules F5；clarification Q9、Q19（UI-4）；畫面 artifact 第 4 版 Gallery.dc.html；login-auth-guard PL7；sidebar-nav、denied-and-not-found 的 `ui-design.md` §元件樹；denied-and-not-found clarification Q8；dashboard-shell `ui-design.md` §元件樹「原語的兩處擴充」、`design/system/components/metric.md` §結構。

#### Scenario: 每個宣告的 variant 都在頁面上

- **WHEN** 介面語言為 `zh-TW`，渲染元件展示頁
- **THEN** Button 六個 variant、三個尺寸、`disabled` 與 `loading`，Badge 六個 variant，Alert 四個 variant，Input 三個狀態，Skeleton 的 `pulse` 與 `shimmer`，都各有一個可辨識的展示項目，可見文字就是值的名稱
- **AND** Button 區塊標頭顯示「variant × 6 · size × 3 · 狀態 × 2」，Badge 區塊顯示「variant × 6」，Alert 區塊顯示「variant × 4」，Input 區塊顯示「狀態 × 3」

#### Scenario: 新原語各有一個區塊

- **WHEN** 渲染元件展示頁
- **THEN** 頁面有 Label、Separator、Dialog、Metric 四個原語區塊，以及「無權限與找不到」區塊，區塊順序依序為 Button、Input、Label、Badge、Alert、Card、Metric、Separator、Dialog、Skeleton · Empty、無權限與找不到、Token 對照
- **AND** 按下 Dialog 區塊的開啟按鈕後出現一個對話框，按 `Esc` 關閉後焦點回到該按鈕

#### Scenario: Metric 區塊展示標籤在上數值在下

- **WHEN** 渲染元件展示頁的 Metric 區塊
- **THEN** 區塊恰有一個 Metric 的展示項目，它有一個標籤與一個數值，標籤在數值上方，兩者都是固定的示意文字

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

### Requirement: 目錄依網址錨點標示目前區塊

元件展示頁的元件目錄 SHALL 是名稱為「元件目錄」的導覽地標，含十二個指向各區塊的錨點連結，順序與區塊相同；網址錨點對應的連結 SHALL 帶 `aria-current`，其他連結不帶。視窗寬度 767px 以下時目錄位於內容上方。

來源：frontend-agent-rules F4、F9；clarification Q19（UI-6）；畫面 artifact 第 4 版 Gallery.dc.html §元件目錄；denied-and-not-found clarification Q8（目錄多一個「無權限與找不到」錨點；原條文的「七個」在 sidebar-nav 加入三個區塊後未同步，一併更正）；dashboard-shell `ui-design.md` §元件樹（多一個 Metric 錨點）。

#### Scenario: 開啟帶錨點的網址時目錄標示該區塊

- **WHEN** 開啟 `/dev/gallery#badge`
- **THEN** 目錄中的「Badge」連結帶 `aria-current`，其餘十一個連結不帶

#### Scenario: 目錄有指向無權限與找不到的錨點

- **WHEN** 開啟 `/dev/gallery#blocked`
- **THEN** 目錄共有十二個連結，「無權限與找不到」連結帶 `aria-current`，它指向的區塊是以「無權限與找不到」命名的 `section`

#### Scenario: 目錄有指向 Metric 的錨點

- **WHEN** 開啟 `/dev/gallery#metric`
- **THEN** 目錄中的「Metric」連結帶 `aria-current`，它排在「Card」與「Separator」之間，指向的區塊是以「Metric」命名的 `section`

#### Scenario: 窄視窗時目錄在內容上方

- **WHEN** 視窗寬度為 767px，開啟元件展示頁
- **THEN** 元件目錄位於頁面標題「元件展示」的上方
