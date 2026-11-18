Label Suite 是研究團隊用的 NLP 標記平台：以設定驅動的流程走完建立任務、試標、一致性確認、正式標記、審核與匯出。介面是工具，不是行銷頁；要穩、清楚、好上手（標記員與審核員以 SUS 75 分衡量）。產品副標是「NLP Annotation Portal」。

本手冊是規則；token 的值以 `tokens.json` 為準，元件長相以 `components/` 為準。

## 鐵律

1. **只用 token，不自創顏色。** 文字、底色、邊框、陰影一律引用 `--color-*`、`--shadow-*` 等 token；需要的顏色沒有 token，就先提出新增，不在元件裡寫死色值。
2. **主色當文字一律用 `--color-primary-strong`，不用 `--color-primary`；圖示用 `--color-primary`，`--color-secondary` 只做裝飾與大面積填色。** `--color-primary` 在淺色主題的白底、頁底、`--color-primary-soft-bg` 上都不到 4.5:1。次要文字最淺用到 `--color-ink-muted`。
3. **語意色只表達語意。** `--color-success`、`--color-warning`、`--color-error`、`--color-info` 只用在狀態、banner、toast、badge；不拿來區分模組或角色。用顏色區分類別時最多五種，超過就靠文字標籤。
4. **狀態不能只靠顏色。** 搭配文字前綴、字重或圖示；例如 Review Status Track 以「目前：」前綴與線寬標出當前節點。
5. **錯誤 toast 不自動消失。** 整頁同時只有一則 toast；success 3000ms、info 5000ms、warning 8000ms、error 只能手動關（UXC-07）。
6. **頁面層級的錯誤用 Alert Banner（`role="alert"`），動作結果用 Toast。**
7. **送出中要進入載入態，而且不能送第二次**（UXC-06）。按鈕用 `.btn-loading`。已知缺口：它只擋滑鼠，鍵盤仍按得動（G-06，要不要改用 `disabled` 尚未裁定）。
8. **Skeleton 的尺寸照載入後的內容量**，以防版面跳動（UXC-08）；所以 Skeleton 的尺寸不做成 token。
9. **每個畫面都要同時支援繁中與英文、淺色與深色。** 用語意 token；深色主題由 `html[data-theme="dark"]` 重新對映同名 token，元件不寫兩份樣式。
10. **互動元件要有 `prefers-reduced-motion` 的退路。**
11. **圖示一律用 SVG。** 不用 emoji，也不用 `✕`、`←`、`→`、`✓`、`▾` 這類字元充當圖示。
12. **破壞性動作先確認**（UXC-10）：確認視窗點遮罩不關，Esc 取消、Enter 確認，確認鈕用實心 `.btn-danger`。
13. **控制項外框用 `--color-border-control`，`--color-border` 只做裝飾。** 輸入框、下拉選單、文字區塊、搜尋框、勾選框的外框要過 3:1；卡片、表格、分隔線用 `--color-border`。
14. **`--color-primary-border` 不能是唯一的提示。** 只靠邊框標示的狀態（例如日期選擇器的今天）改用 `--color-primary`。

## 色彩

淺色與深色是**同一組 token 名、不同的值**。

| 角色 | token | 怎麼用 |
| :--- | :--- | :--- |
| 品牌主色 | `--color-primary`、`--color-secondary` | logo 底色、按鈕填色、選取、圖示。`--color-primary` 不當文字；`--color-secondary` 只做裝飾與大面積填色 |
| 主色文字 | `--color-primary-strong`、`--color-on-cta` | 主色當文字（含連結）用前者；填色鈕上的文字用後者 |
| 主色淺底 | `--color-primary-soft-bg`、`--color-primary-border` | 選取列、hover 底、裝飾性的主色外框 |
| 確認與完成 | `--color-cta`、`--color-cta-hover` | 確認、完成類主要鈕 |
| 頁面層次 | `--color-surface`（頁底）、`--color-white`（卡片）、`--color-slate-50`（交錯列） | 語意別名是 `--bg-page`、`--bg-surface` |
| 文字 | `--color-ink`、`--color-ink-muted`、`--color-on-ink` | 別名 `--fg-1`、`--fg-2`、`--fg-3`。`--color-text-muted` 是舊別名，新元件不用 |
| 分隔 | `--color-border`、`--color-border-muted` | 分隔線與裝飾性外框 |
| 控制項外框 | `--color-border-control` | 輸入框、下拉選單、文字區塊、搜尋框、勾選框 |
| 四個語意 | `--color-{success,warning,error,info}`，各配 `-bg`、`-border`；前三者另有 `-soft-bg`、`-soft-border` | 狀態、banner、toast、badge |
| 工作頁籤 | `--color-tab-active-bg`、`--color-tab-hover-bg`、`--nav-active-bg` | 側欄的工作頁籤與導覽選取 |
| 非語意強調 | `--color-file-markdown` | 只用來區分檔案類型圖示 |

- **不要把 `--color-white` 當成字面上的白色。** 它在深色主題是「抬高一階的卡片底」；需要固定的淺色字時用 `--color-on-cta` 或 `--color-on-ink`。
- 實體標記、Color Dot 的色盤是**資料色**，不是語意色，也不在 token 裡。

## 字體

| token | 用途 |
| :--- | :--- |
| `--font-serif-display`（Crimson Pro） | `h1`、`h2`、`.display`，以及 wordmark「Label Suite」。沒有中文字形，備援接 Noto Serif TC |
| `--font-sans`（Inter） | 介面預設字體，`h3` 起都用它 |
| `--font-sans-reading`（Atkinson Hyperlegible） | 標記員閱讀的長文本 |
| `--font-mono`（JetBrains Mono） | 程式碼、ID |

- 字級：`--text-display` 48、`--text-h1` 36、`--text-h2` 24、`--text-h3` 18、`--text-body` 16、`--text-caption` 14、`--text-label` 12。
- 行高：中文內文 `--leading-body-zh`（1.8），英文內文 `--leading-body`（1.6）；依 `html[lang]` 切換。
- 大標（`h1`、`h2`、`.display`）與 wordmark 用襯線，其餘一律用無襯線。

## 間距、圓角、陰影、動態、層級

- 間距只用 `--space-xs`（4）到 `--space-3xl`（64）七階。
- 圓角：`--radius-sm` 4、`--radius-md` 8、`--radius-lg` 12、`--radius-xl` 16、`--radius-full`。按鈕與輸入框用 `--radius-md`；角色 badge 用 `--radius-full`。
- 陰影：卡片用 `--shadow-card`，其他陰影只用 `--shadow-sm` 到 `--shadow-xl`。不加裝飾性陰影，也不用漸層。深色主題的陰影以細環線為主。
- 動態：`--ease-standard` 搭 `--dur-fast`（150ms）或 `--dur-normal`（200ms）。hover 唯一允許的位移是 `translateY` 最多 `-2px`。
- 層級：`--z-base` → `--z-raised` → `--z-dropdown` → `--z-sticky` → `--z-modal` → `--z-toast` → `--z-tooltip`；toast 在 modal 之上，tooltip 最上。

## 版面

- 登入後每一頁共用側欄（App Shell）：品牌區在最上，接著工作頁籤與導覽；側欄可收合。工作頁籤最多 8 個。
- 「工作頁籤」是側欄上的跨頁頁籤，「Content Tabs」是單一頁面內的分頁列；兩者不要混用。
- 帳號頁是置中單卡（Auth Card），頂部 navbar 只有 logo 與語言切換。
- 斷點：手機 `max-width: 767px`、桌面 `min-width: 768px`、小螢幕 `max-width: 420px`。
- 寬度：登入後內容最大 1280px；帳號頁單卡最大 480px；Modal 小 400、中 520、大 720。

## 內容與語氣

- **雙語對等。** 每個字串都有繁中與英文兩份，aria-label 也一樣。品牌名「Label Suite」不翻譯。頁面標題寫成 `Label Suite — <頁名>`。
- **稱謂用「你」**，不用「您」。
- **按鈕用「動詞＋受詞」說出結果**：登入、建立帳號、寄送重設連結、送出標記、送出審核。用「送出」，不用「提交」；不寫「確定」這類空動詞。英文用 Title Case、不加句點。
- 表單通用鈕是「儲存」與「取消」；載入中寫成「建立中…」。
- **送出鈕旁說明後果**，例如「送出後即定稿，成為最終答案」。
- **錯誤訊息說出原因與下一步**：欄位驗證以「請」開頭（「請輸入電子郵件」）；把規則寫進訊息；登入失敗不指出是帳號還是密碼。
- 送出時才驗證（UXC-04）；使用者一開始改欄位就收掉那個欄位的錯誤（UXC-05）。
- 「從來沒有資料」與「篩不到資料」用不同文案，只有後者給「清除篩選」（UXC-09）；載入失敗絕不顯示成空資料。
- 格式：日期 `YYYY-MM-DD`、時間 24 小時制 `HH:mm`、千分位用逗號、百分比小數一位。中文介面寫「電子郵件」，英文寫「Email」。中文問號用全形，破折號用「——」。

## 圖示與 logo

- 圖示來源是 Lucide（ISC 授權）：24×24、`stroke-width="2"`、`fill="none"`、`stroke="currentColor"`、圓角端點。顏色由文字色繼承，不另上色。
- 純裝飾圖示加 `aria-hidden="true"`；單獨成為控制項的圖示要有 `aria-label`。
- 標誌只有一個圖形：Lucide 的 `tag` 形，放在 `--color-primary` 圓角方上。圓角是邊長的 25%；最小 16px；安全留白是圖示高度的 25%；圖與 wordmark 的間距是圖示高度的三分之一；圖在左、wordmark 在右，垂直置中。
- wordmark 永遠是 Crimson Pro 粗體「Label Suite」，色用 `--color-ink`。
- 不拉伸、傾斜、旋轉或裁切 logo；不在 token 之外改色；不加陰影、漸層、描邊或光暈。
- 深色主題的 logo 線稿用 `--color-on-cta`：白色線稿疊在深色主題的 `--color-primary` 上只有 2.98:1。

各 logo 檔的用途見 `assets/Logos/README.md`。

## 對比不足的 token 組合

以下是兩種主題中未達 WCAG AA 的組合（文字 4.5:1；邊框、圖示 3:1）。用到這些組合時，要嘛換 token，要嘛確定它不承擔辨識。`--color-on-cta` 疊在淺色 `--color-primary` 上是唯一明文接受的例外。

| 前景 | 底 | 用途 | 下限 | 淺色 | 深色 |
| :--- | :--- | :--- | ---: | ---: | ---: |
| `--color-primary` | `--color-white` | 文字 | 4.5:1 | 4.47 未達 | 6.02 |
| `--color-primary` | `--color-surface` | 文字 | 4.5:1 | 4.07 未達 | 6.57 |
| `--color-primary` | `--color-primary-soft-bg` | 文字 | 4.5:1 | 3.99 未達 | 5.36 |
| `--color-on-cta` | `--color-primary` | 文字 | 4.5:1 | 4.47 未達（已接受） | 5.36 |
| `--color-border` | `--color-white` | 邊框 | 3:1 | 1.23 未達 | 1.27 未達 |
| `--color-border` | `--color-surface` | 邊框 | 3:1 | 1.12 未達 | 1.38 未達 |
| `--color-primary-border` | `--color-white` | 邊框 | 3:1 | 1.49 未達 | 1.81 未達 |
| `--color-secondary` | `--color-white` | 圖示 | 3:1 | 2.98 未達 | 9.01 |

- `--color-primary` 當文字的三列不再使用：主色文字一律換成 `--color-primary-strong`（白底 6.29、主色淺底 5.62:1）。
- `--color-border` 在兩種主題都不到 3:1，只能當裝飾性分隔，不能單獨承擔「這裡有一個控制項」的辨識；控制項外框用 `--color-border-control`（淺色白底 3.55、頁底 3.23:1；深色卡片 3.42、頁底 3.73:1）。
- `--color-secondary` 不當圖示色，圖示用 `--color-primary`。
- 可見的焦點樣式目前大多缺席，「所有互動元件都有可見焦點」是目標，還不是現況。

## 未同步

- **token 沒有略過。** `tokens.css` 的每一個變數都收進了 `tokens.json`，值照抄，沒有重新調色。
- **元件的頁面別名。** 帳號頁不載入 `tokens.css`，自己定義 `--color-card`、`--color-border-focus`、`--color-link`；`components/bundle.css` 把它們綁回 `--color-white`、`--color-primary`、`--color-primary`，兩種主題都一致。
- **寫死的色值。** 原型裡仍有不走 token 的色值（設計落差 G-02），`bundle.css` 照抄，沒有改：任務型別 badge 的六組色、`.btn-language` 的 hover、原型狀態切換列（Proto Toggle Bar）、輸入框焦點環的 `color-mix()` 等。新元件不要沿用。
- **logo 檔案。** SVG 無法引用 CSS 變數，所以 logo 檔保留寫死色值；`banner.svg` 與 `social-preview.svg` 的副標灰跟著 `--color-ink-muted` 改成 `#5E6B7F`。深色主題專用的 logo 還沒有做。
