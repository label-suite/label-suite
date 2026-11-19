輸入文字的欄位：單行 `.input` 或多行 `.input-textarea`，可在下方加 `.field-hint` 說明或 `.field-error` 錯誤訊息。

## 何時使用

- 使用者要輸入自由文字（任務名稱、說明、電子郵件）時。
- 選項有限時改用下拉或 [Chip](../Chip/README.md)；開關型設定用 [ToggleSwitch](../ToggleSwitch/README.md)；日期區間用 [DateRangePicker](../DateRangePicker/README.md)；列表上方的搜尋框用 [ListToolbar](../ListToolbar/README.md) 的 `.search-input`。
- 密碼欄位搭配 [PasswordEyeToggle](../PasswordEyeToggle/README.md)。

## 結構與使用方提供的內容

- 必填：`.input`（`<input>`）或 `.input-textarea`（`<textarea>`，`resize: vertical`、最小高度 100px）。
- `.input` 本身**不含 label**。使用方提供 `<label for>` 或至少 `aria-label`。
- 選用：`.field-hint`，放在欄位下方，寫格式或字數限制（「3–40 字元，建立後可修改。」）。
- 選用：`.field-error`，帶 `role="alert"`，寫具體的錯誤原因與修正方式。
- 使用方負責把 hint／error 的 id 串到欄位的 `aria-describedby`，並在錯誤時設 `aria-invalid="true"`；原型沒有這段接線。

## 變體

| class | 用途 |
| :--- | :--- |
| `.input` | 單行欄位 |
| `.input-textarea` | 多行欄位 |
| `.input.error` | 驗證失敗，邊框換錯誤色，下方配 `.field-error` |
| `.input[readonly]`／`.input.readonly` | 系統管理、不可編輯的值（例如 SSO 帳號的電子郵件）；語意不同於停用 |

## 狀態

| 狀態 | 表現 |
| :--- | :--- |
| 預設 | `--color-surface` 底、`--color-border-control` 外框、`--radius-md` 圓角、16px 字 |
| 空 | 由 `placeholder` 表達，沒有專屬樣式 |
| focus | 邊框換 `--color-primary`，外加 3px 的柔和焦點環 |
| 錯誤 | `.input.error` ＋ `.field-error` |
| 唯讀 | 淺灰底、淡字、`cursor: not-allowed` |
| hover、停用 | 原型沒有定義 |

G-04：焦點環原本有兩份寫法，#438 已把 showcase 的 `rgba(99,102,241,0.12)` 換成和 `input.css` 相同的 `color-mix(in srgb, var(--color-primary) 12%, transparent)`。兩份的底色仍不同：`input.css` 用 `--color-surface`，showcase 用 `--color-white`；以 `input.css` 為準。

## 該做／不該做

- **該做**：每個欄位都有可見的 label 或 `aria-label`，錯誤訊息說明怎麼修。
- **該做**：用 token 版的焦點環（G-04）；並在高對比模式下保留 `outline`，因為原型寫了 `outline: none` 只靠 `box-shadow`，高對比下焦點會消失（G-05）。
- **不該做**：寫死色值。`.input.error`、唯讀、hint、error 原本有 6 個寫死的顏色，#420 起都改用 token（`--color-error`、`--color-slate-50`、`--color-border-muted`、`--color-ink-muted`，G-02），唯讀底色在深色主題下也跟著換；實作時照這組 token，不要抄舊值。
- **不該做**：在帳號頁另寫一份 `.field-hint`／`.field-error`（G-03），共用這一份。
- **不該做**：用唯讀表示「暫時不能編輯」；那是停用。
