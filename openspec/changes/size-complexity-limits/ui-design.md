# UI Design

本次無 UI 變更。

理由：本 change 只新增 lint 上限（ESLint、ruff 設定與可能的檢查腳本）與規則文件，不新增或修改任何頁面、路由、元件或畫面狀態。

## 給下游的備註

- `frontend/src/pages/dev-gallery/dev-gallery-page.tsx` 的頁面元件函式（174 行）是目前前端唯一會被新函式行數上限擋下的既有程式碼。它只可能因為 clarification 決定的**具名例外**或**重構**而被動到；兩種做法都不得改變畫面（無視覺變更），並且要保留 `component-gallery` 既有的測試通過。
- 具體做法由 clarification 的 Q3、Q4、Q8 決定，本文件不預先選定。
