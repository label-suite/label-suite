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
     框架依 ADR-004 加 2026-11-10 裁定（React 19 加 Vite、目錄分層 pages/ 加 features/、元件庫 shadcn/ui 放 components/ui/，
     見 docs/development/architecture.md §前端）；**只有 Storybook 仍待決**，
     元件以語意描述為主（例如「主要按鈕」「資料表」），需要時可指名 shadcn/ui 的元件，不貼實作程式碼。
     圖示統一 Lucide。 -->
