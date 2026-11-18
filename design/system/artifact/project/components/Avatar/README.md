使用者頭像：清單裡只顯示的小圖，以及個人資料頁可點擊上傳的大圖。

## 何時使用

- 顯示用：導覽列、成員清單旁的使用者頭像。
- 可上傳：個人資料頁讓使用者更換自己的頭像；沒有頭像時顯示姓名首字。

## 結構與使用方提供的內容

**顯示用**

- `img.avatar-sm`，32px 圓形；使用方提供圖片網址與 `alt`。

**可上傳**

- `.avatar-wrap`：`role="button"`、`tabindex="0"`、`aria-describedby` 指向提示文字。
- 裡面放 `.avatar-preview`（首字或圖片）、`.avatar-overlay`（hover 時出現的上傳圖示，`aria-hidden="true"`）與隱藏的 `input[type="file"]`。
- 下方 `.avatar-hint` 寫格式限制；`.avatar-error` 帶 `role="alert"`，加 `.visible` 才顯示。

**上傳規格**

- 只接受 JPEG、PNG、WebP，最大 5 MB。
- 預覽用 `URL.createObjectURL`，不要用 `innerHTML` 塞內容。

## 變體

- 顯示用（32px）與可上傳兩種。
- 可上傳的尺寸在各處是 64、80、72px，彼此不一致（G-17）。
- 「移除頭像」動作不在正典裡（G-17）。

## 狀態

- 預設：顯示首字或圖片。
- hover：`.avatar-overlay` 浮出半透明遮罩與上傳圖示。暗色主題下圖示用 `--color-white`，會跟著變暗而幾乎看不見，是 token 對應的問題。
- focus：`:focus-visible` 時 2px 主色外框。
- 錯誤：檔案不符時 `.avatar-error.visible` 顯示原因（「檔案超過 5 MB」）。
- 有幾個寫死值（G-02）。

## 該做／不該做

- 該做：用鍵盤（Enter、空白鍵）也能開啟檔案選擇。
- 該做：上傳前先檢查格式與大小，錯誤寫明是哪一項不符。
- 不該做：用 `innerHTML` 把檔名或圖片插進頁面。
- 不該做：在新頁面再發明第四種尺寸。
