Accordion 是一組可以各自展開、收合的面板，每個面板有編號、標題和一個箭頭，點標題列切換內容的顯示。

## 何時使用

- 一頁有好幾段同層級的設定，使用者通常一次只改其中一兩段時使用。例如輸出設定依任務類型分成「分類設定」「實體辨識設定」。
- 可以同時展開多個面板，不是「只開一個」的手風琴。
- 內容很短、一眼就能看完時不要折起來，直接列出。

## 結構與使用方提供的內容

- `.output-accordion`：一個面板，有框線和圓角。
- `.output-accordion-header`：標題列，14px、600，hover 底色 `--color-primary-soft-bg`。要有：
  - `role="button"`、`tabindex="0"`；
  - `aria-expanded`；
  - `aria-controls` 指向內容的 id。
- 標題列裡有三樣東西：
  - `.output-accordion-number`：編號；
  - `.output-accordion-title`：標題；
  - `svg.output-accordion-chevron`：`chevron-down.svg`。
- `.output-accordion-body[role=region][aria-label][id]`：內容區。
- `-number` 和 `-title` 出現在樣本裡，但正典 CSS 沒有定義它們；字級字重來自標題列本身（G-15）。
- 使用方提供編號、標題和內容，並在點擊與 Enter／Space 時切換 `.collapsed` 和 `aria-expanded`。

## 變體

只有一種。shipped 頁面的標題列改用原生 `<button>`，比 showcase 的 `div[role=button]` 好：不用自己補 Enter／Space 的處理。

## 狀態

- 展開：預設，內容顯示，箭頭朝下。
- 收合 `.collapsed`：內容隱藏，箭頭旋轉 −90° 朝右。
- hover：標題列換成淡主色底。
- focus：標題列聚焦得到也按得動，但沒有任何 `:focus` 樣式（G-05）。
- disabled／載入中／錯誤／空：未定義。

## 該做／不該做

- 該做：標題列用原生 `<button type="button">`，`aria-expanded` 與 `.collapsed` 同步更新。
- 該做：內容區用 `role="region"` 加 `aria-label`，讓展開的內容可以被導覽。
- 該做：補上焦點樣式，等 G-05 定案；在那之前不要把瀏覽器預設外框重設掉。
- 不該做：一次只允許一個面板展開。這個元件的契約是可同時展開多個。
- 不該做：把必填欄位藏在預設收合的面板裡，使用者會看不到驗證錯誤。
