指標小卡：一個小標題加一個大數字，讓人一眼看到總量或比率。

## 何時使用

- 儀表板、資料集分析、任務概覽頂端的關鍵數字：已完成任務、平均 IAA、待審項目。
- 需要比較趨勢或分布時用圖表，不用一排 Metric。

## 結構與使用方提供的內容

- `.metric` > `span`（標籤，11px 大寫）+ `strong`（數值，1.35rem）。
- 可選的 `.metric-desc`（`div`），放補充說明，例如「比上週少 8 筆」。
- 樣式用元素選擇器抓 `span` 與 `strong`，所以 `.metric` 裡不能再放別的 `span`。
- 多張並排時，排版容器由使用方自備；預覽裡的 `.metric-grid` 只是展示用，不是正典。

```html
<div class="metric">
  <span>待審項目</span>
  <strong>42</strong>
  <div class="metric-desc">比上週少 8 筆</div>
</div>
```

## 變體

- 預設：數值 1.35rem。
- `.metric-lg`：寫成 `<div class="metric metric-lg">`，數值放大到 2.5rem，用在一頁只強調一個數字時。

## 狀態

- 載入中：整張卡換成 Skeleton，不在數字位置放「--」或 spinner。
- 正典漏了 `display: block`（G-19），放進行內容器時要注意。
- 靜態，沒有 hover 或點擊；需要點進去看明細時，外層包連結或用 Card。

## 該做／不該做

- 該做：標籤寫清楚單位與範圍（「平均 IAA」「待審項目」）。
- 該做：同一排的卡片用同一種尺寸。
- 不該做：在 `.metric` 裡多放 `span`，會被當成標籤樣式。
- 不該做：用顏色表示數字好壞；需要時加 Badge 或在 `.metric-desc` 用文字說明。
