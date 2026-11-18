Label Suite 的標誌只有一個圖形：Lucide 的 `tag`（標籤）形，中間一點。圖形在左、wordmark「Label Suite」（Crimson Pro 粗體）在右，垂直置中。檔案的來源在 repo 的 `design/prototype/assets/logo/`，色值寫死在 SVG 裡，對應的 token 寫在各檔說明中（以淺色主題的值為準）。

## icon.svg

24×24 的單色標籤線稿，線寬 2，沒有圓角方。**墨色是 `currentColor`**：它繼承放置處的文字色，單獨以 `<img>` 顯示時會呈黑色。用在需要跟著文字色走的單色圖示；要上色就放進文字色是 `--color-ink` 或 `--color-primary-strong` 的容器裡，以內嵌 SVG 使用。

## icon-colored.svg

48×48 的圓角方（`rx` 12，邊長的 25%），填 `--color-primary`，中間是白色標籤線稿（對應 `--color-on-cta` 的淺色值）。用途：App 圖示、頭像、**favicon 的來源**。最小 16px；四周留白至少是圖示高度的 25%。深色主題不要直接用這一版：白色線稿疊在深色主題的 `--color-primary` 上只有 2.98:1，深色版的線稿要改用 `--color-on-cta`。

## logo-horizontal.svg

200×48 的橫式 lockup：左邊同 `icon-colored.svg`，右邊 wordmark 24px 襯線粗體，色是 `--color-ink`。圖與文字的間距是圖示高度的三分之一（16 ÷ 48）。用在頁首、文件與簡報；最小寬度 100px。

## banner.svg

1280×200 的 README 橫幅：白底（`--color-white` 的淺色值），左側 144px 圓角方加標籤，右側 wordmark 96px，下方副標「NLP Annotation Portal」24px，色是 `--color-ink-muted`。只用在 repo 的 README。已知與規則不符：圓角約 22%（規則是 25%）、線稿線寬 1.8、圖文間距 25%（規則是三分之一）。

## social-preview.svg

1280×640 的 GitHub social preview：頁底 `--color-surface`，左側 160px 圓角方加標籤，右側 wordmark 80px 與 32px 副標。只用在 GitHub 的社群預覽圖。已知與規則不符：副標的灰色沒有對應 token（規則是 `--color-ink-muted`），圖文間距是 25%。

## 不要

- 不拉伸、傾斜、旋轉或裁切，只等比縮放。
- 不在 token 之外改色，不替換 wordmark 的字體，不改圖文間距。
- 不加陰影、漸層、描邊或光暈。
