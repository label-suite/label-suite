# UI Design

<!-- 沒有 UI 變更時，整份只寫：本次無 UI 變更。
     畫面長相以 design/prototype/pages/ 為準，規格只寫規則；這一份寫的是前端要照著做的結構，不是重新設計畫面。 -->

## 頁面與路由

| 路由 | 頁面 | 對應的規格 | 需要的角色 |
| :--- | :--- | :--- | :--- |

## 常駐文件異動

<!-- 路由、頁面元件、對應的規格編號或 Logic Flow 節點有異動時，先改常駐文件，這一節只寫路徑與異動摘要，不重抄常駐文件的內容。
     動到前端骨架（單一 HTTP 邊界、生成的 hooks 與 MSW mock、元件展示頁）時，改它的「前端骨架」節。
     沒有異動時，刪掉路徑與表格，只寫一行「本次無常駐文件異動」。 -->

- 常駐文件：`docs/diagrams/architecture/frontend-routes.mdx`

| 節 | 異動 | 摘要 |
| :--- | :--- | :--- |

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
     見 docs/development/architecture.mdx §前端）；**不用 Storybook，改用元件展示頁**，
     元件以語意描述為主（例如「主要按鈕」「資料表」），需要時可指名 shadcn/ui 的元件，不貼實作程式碼。
     圖示統一 Lucide。 -->
