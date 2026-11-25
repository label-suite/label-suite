# UI Design

本次無 UI 變更。

理由：本 change 只新增 lint 上限（ESLint 與 ruff 設定、常駐探針測試，以及 `scripts/check.mjs` 的探針名清單，不新增腳本）與規則文件，不新增或修改任何頁面、路由、元件或畫面狀態。

## 給下游的備註

- `frontend/src/pages/dev-gallery/dev-gallery-page.tsx` 的頁面元件函式（174 行）是目前前端唯一超過新函式行數上限（80 行，Q3）的既有程式碼。依 clarification Q8，本 change **不重構**，改以具名豁免處理：`frontend/eslint.config.js` 的 `NAMED_EXEMPTIONS` 為此檔放寬 `max-lines-per-function` 至 180（剛好高於現況），註明 `#561` 與理由。探針測試會斷言豁免清單內每個檔案仍然超標，修好後豁免過期即失敗。
- 因為不重構、不改動該檔，本 change **無視覺變更**，`component-gallery` 既有測試應維持通過。
- 後端檔案行數上限（400 行，Q5）由 `backend/tests/unit/` 的 pytest 測試執行，不是獨立的檢查腳本；本 UI 文件的範圍不涉及後端檔案。
