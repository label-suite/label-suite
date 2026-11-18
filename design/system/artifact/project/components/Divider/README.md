Divider 是區隔內容的細線，有三種形式：單純的水平線、中間帶文字的分隔線，以及清單項目之間的分隔線。

## 何時使用

- 水平線 `.divider-hr`：同一個卡片或面板裡，前後兩段內容需要隔開時。
- 文字分隔 `.divider-text`：正典只指定一個用途，就是登入頁在 OAuth 按鈕與帳號密碼表單之間放「或」。
- 清單分隔 `.divider-list`：一串同層級的短項目，例如活動紀錄、設定摘要。
- 不同卡片之間不用 Divider，用卡片自己的間距。

## 結構與使用方提供的內容

- `hr.divider-hr`：1px 線，顏色 `--color-border`，上下留白。
- `.divider-text`：橫排，`hr.divider-hr` 加中間的 `span` 文字，再加一個 `hr.divider-hr`。
- `ul.divider-list > li`：每個 `li` 之間有一條分隔線。
- 使用方只提供文字分隔的文字，或清單項目內容。
- token：`--color-border`、`--color-ink-muted`（文字分隔的文字）。

## 變體

- 水平線、文字分隔、清單分隔三種，見上。
- 實作上的分歧：
  - 登入頁並沒有用正典的 `.divider-text`，而是用 `.auth-page .divider` 加 `::before`／`::after` 偽元素畫線（見 Auth Card 的 preview）；這個元件唯一指名的用途，實作上沒有採用正典（G-18）。
  - `dataset-analysis-detail` 用自己的 `hr.panel-divider`，也不是 `.divider-hr`（G-18）。

## 狀態

只有預設。分隔線不可互動，沒有 hover、focus、disabled、載入中、錯誤或空狀態。深色模式跟著 `--color-border` 變。

## 該做／不該做

- 該做：同一個畫面只用一種分隔線取色方式。目前 `.divider-list` 的線是寫死值，和 `.divider-hr` 的 `--color-border` 不一致，深色模式下會不協調（G-02）。
- 該做：純裝飾的分隔線用 `hr`，或加 `aria-hidden`，不要讓螢幕閱讀器讀到空的元素。
- 不該做：在文字分隔裡放「或」以外的長句；它只是視覺上的「二選一」提示。
- 不該做：用 `border-bottom` 在每個頁面各寫一條自己的分隔線，取代 `.divider-hr`。
