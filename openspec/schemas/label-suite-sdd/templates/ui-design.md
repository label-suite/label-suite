# UI Design

<!-- 沒有 UI 變更時，整份只寫：本次無 UI 變更。
     畫面長相以 design/prototype/pages/ 為準，規格只寫規則；這一份寫的是前端要照著做的結構，不是重新設計畫面。 -->

## 頁面與路由

| 路由 | 頁面 | 對應的規格 | 需要的角色 |
| :--- | :--- | :--- | :--- |

## 元件樹

```text
PageName
├─ Toolbar
└─ DataTable
```

## 資料來源

| 區塊 | operationId | 快取鍵／失效時機 |
| :--- | :--- | :--- |

## 畫面狀態

| 狀態 | 呈現 |
| :--- | :--- |
| loading |  |
| error |  |
| empty |  |
| 無權限（403） |  |
| 欄位被遮蔽 |  |

## 元件與 design token

<!-- token 以 design/prototype/assets/tokens.css 與 label-suite-design skill 為唯一來源，**不寫色碼、不自訂間距**。
     框架依 ADR-004（React 加 Vite）；**只有元件庫尚未定案**（見 docs/development/architecture.md §前端），
     所以元件寫成語意描述（例如「主要按鈕」「資料表」），不要寫成某個元件庫的 API。
     圖示統一 Lucide。 -->
