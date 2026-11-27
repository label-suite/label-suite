# Spec Delta

## MODIFIED Requirements

### Requirement: 展示頁列出每個宣告的項目

元件展示頁 SHALL 依序以 Button、Input、Label、Badge、Alert、Card、Separator、Dialog、Skeleton · Empty、無權限與找不到、Token 對照十一個區塊展示；原語宣告的每一個 variant、尺寸，以及 Button 的 `disabled`、`loading` 與 Input 的預設、驗證錯誤、停用狀態，各在頁面上出現一次，且可被測試辨識為「元件、維度、值」。Dialog 區塊有一個開啟範例對話框的按鈕。每個區塊標頭的計數 SHALL 由宣告的集合算出。`components/ui/` 的每一個原語都 MUST 出現在展示頁。

來源：ADR-005 D3；frontend-agent-rules F5；clarification Q9、Q19（UI-4）；畫面 artifact 第 4 版 Gallery.dc.html；login-auth-guard PL7、`ui-design.md` §元件樹 › 登入頁；sidebar-nav `ui-design.md` §元件樹（快捷鍵總覽的對話框原語）；denied-and-not-found clarification Q8、`ui-design.md` §元件樹 › 元件展示頁的一節「無權限與找不到」。

#### Scenario: 每個宣告的 variant 都在頁面上

- **WHEN** 介面語言為 `zh-TW`，渲染元件展示頁
- **THEN** Button 六個 variant、三個尺寸、`disabled` 與 `loading`，Badge 六個 variant，Alert 四個 variant，Input 三個狀態，都各有一個可辨識的展示項目，可見文字就是值的名稱
- **AND** Button 區塊標頭顯示「variant × 6 · size × 3 · 狀態 × 2」，Badge 區塊顯示「variant × 6」，Alert 區塊顯示「variant × 4」，Input 區塊顯示「狀態 × 3」

#### Scenario: 新原語各有一個區塊

- **WHEN** 渲染元件展示頁
- **THEN** 頁面有 Label、Separator、Dialog 三個原語區塊，以及「無權限與找不到」區塊，區塊順序依序為 Button、Input、Label、Badge、Alert、Card、Separator、Dialog、Skeleton · Empty、無權限與找不到、Token 對照
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

### Requirement: 目錄依網址錨點標示目前區塊

元件展示頁的元件目錄 SHALL 是名稱為「元件目錄」的導覽地標，含十一個指向各區塊的錨點連結，順序與區塊相同；網址錨點對應的連結 SHALL 帶 `aria-current`，其他連結不帶。視窗寬度 767px 以下時目錄位於內容上方。

來源：frontend-agent-rules F4、F9；clarification Q19（UI-6）；畫面 artifact 第 4 版 Gallery.dc.html §元件目錄；denied-and-not-found clarification Q8（目錄多一個「無權限與找不到」錨點；原條文的「七個」在 sidebar-nav 加入三個區塊後未同步，一併更正）。

#### Scenario: 開啟帶錨點的網址時目錄標示該區塊

- **WHEN** 開啟 `/dev/gallery#badge`
- **THEN** 目錄中的「Badge」連結帶 `aria-current`，其餘十個連結不帶

#### Scenario: 目錄有指向無權限與找不到的錨點

- **WHEN** 開啟 `/dev/gallery#blocked`
- **THEN** 目錄共有十一個連結，「無權限與找不到」連結帶 `aria-current`，它指向的區塊是以「無權限與找不到」命名的 `section`

#### Scenario: 窄視窗時目錄在內容上方

- **WHEN** 視窗寬度為 767px，開啟元件展示頁
- **THEN** 元件目錄位於頁面標題「元件展示」的上方

## ADDED Requirements

### Requirement: 展示頁展示無權限與找不到的樣本

元件展示頁的「無權限與找不到」區塊 SHALL 依序展示三個樣本：找不到（帶識別碼）、無權限（帶識別碼）、識別碼很長的找不到；每個樣本可被測試辨識為「元件、維度、值」，標題為二級，返回連結的標籤為「回儀表板」、去處為 `/dashboard/dashboard`。開啟展示頁 MUST NOT 把焦點移到任何樣本；樣本只用固定的示意字面與示意識別碼。

來源：denied-and-not-found clarification Q1、Q3、Q8；`ui-design.md` §元件樹 › 元件展示頁的一節「無權限與找不到」、§文案；規格 07-03 §畫面的組成、§找不到的畫面、§無權限的畫面。

#### Scenario: 區塊展示三個樣本

- **WHEN** 介面語言為 `zh-TW`，渲染元件展示頁的「無權限與找不到」區塊
- **THEN** 區塊依序有 `blocked-screen` 的 `kind` 為 `notFound`、`denied`、`longIdentifier` 三個展示項目，區塊標頭顯示「樣本 × 3」
- **AND** `notFound` 樣本的標題是「找不到這個任務」，`denied` 樣本的標題是「無權限檢視此任務」，三個樣本的標題都是二級標題

#### Scenario: 樣本的返回連結到儀表板

- **WHEN** 渲染「無權限與找不到」區塊
- **THEN** 三個樣本各恰有一個連結，可存取名稱為「回儀表板」、`href` 為 `/dashboard/dashboard`

#### Scenario: 開啟展示頁不搶焦點

- **WHEN** 開啟 `/dev/gallery`
- **THEN** 焦點不在任何樣本的標題上

#### Scenario: 長識別碼樣本不撐破版面

- **WHEN** 視窗寬度分別為 375px 與 1280px，開啟 `/dev/gallery#blocked`
- **THEN** `longIdentifier` 樣本的說明完整包含它的示意識別碼，樣本容器與「無權限與找不到」區塊的 `scrollWidth` 都不大於各自的 `clientWidth`
