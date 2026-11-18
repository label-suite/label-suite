Breadcrumb 是頁首上方的一行路徑，告訴使用者目前頁在哪一層，並能點回上一層。

## 何時使用

- 詳情頁或子頁面，需要一條回到上層清單的路徑時使用，例如「任務管理 › 任務詳情」。
- 頂層頁（儀表板、任務管理清單）不放；側欄已經標出目前位置。
- 正典說最深兩層，但 showcase 的 Review Status Track 樣本已經用了三層，`annotation-list` 的註解還自稱「compact form」。層數上限尚待裁定（G-13），新頁面先維持兩層。

## 結構與使用方提供的內容

- `nav.breadcrumb[aria-label="breadcrumb"]`：13px、`--color-text-soft`、下緣 12px 間距、項目間 6px。
- 上層各是一個 `a`，顏色 `--color-primary`，hover 加底線。
- 層與層之間是 `span.breadcrumb-sep[aria-hidden="true"]`，顏色 `--color-ink-muted`。
- 最後一層是目前頁：`span[aria-current="page"]`，不可點。
- 使用方提供每一層的文字和連結。
- token：`--color-text-soft`、`--color-primary`、`--color-ink-muted`。

## 變體

只有一種。分隔符號在原件是文字字元（showcase 與 `dataset-analysis-detail` 用 ›，`task-detail` 用 /）；preview 依「不以字元當圖示」的規則，改放 `chevron-right.svg` 的內嵌 SVG，尺寸 12px。

## 狀態

- 預設：有。
- 連結 hover：加底線。
- focus：沒有焦點樣式，用 `:focus` 掃正典區塊 0 命中（G-05）。
- disabled／載入中／錯誤／空：不適用。

## 該做／不該做

- 該做：最後一層用 `aria-current="page"`，不要做成連結。
- 該做：分隔符號加 `aria-hidden="true"`，螢幕閱讀器只讀層級文字。
- 該做：補上焦點樣式前，至少確認瀏覽器預設外框沒被頁面重設掉（G-05）。
- 不該做：超過兩層，除非 G-13 裁定放寬。
- 不該做：用麵包屑取代頁面標題；它只是路徑，標題仍由頁首提供。
