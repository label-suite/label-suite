# UI Design

<!-- 沒有 UI 變更時，整份只寫：本次無 UI 變更。
     畫面長相以 design/prototype/pages/ 為準，規格只寫規則；這一份寫的是前端要照著做的結構，不是重新設計畫面。 -->

## 頁面與路由

| 路由 | 頁面 | 對應的規格 | 需要的角色 |
| :--- | :--- | :--- | :--- |

## 常駐文件異動

<!-- 動到前端骨架（單一 HTTP 邊界、生成的 hooks 與 MSW mock、元件展示頁）時，改它的「前端骨架」節。
     沒有異動時，刪掉路徑與表格，只寫一行「本次無常駐文件異動」。 -->

- 常駐文件：`docs/diagrams/architecture/frontend-routes.mdx`

| 節 | 異動 | 摘要 |
| :--- | :--- | :--- |

## 元件樹

<!-- 每個元件引用 design/system/components/<元件>.md，寫明「沿用 <路徑>」（照該規格的「程式實作」）或「新建，放 <路徑>」。
     設計系統的共用元件（規格沒有標「單頁專屬」或「原型鷹架」）只能放 frontend/src/components/，不寫「由 design.md 決定」。
     設計系統沒有對應規格的元件，寫「設計系統無」與新建的位置。 -->

```text
PageName
├─ Toolbar        list-toolbar.md：新建，放 frontend/src/components/ui/list-toolbar.tsx
└─ SubmitButton   button.md：沿用 frontend/src/components/ui/button.tsx
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

<!-- 圖示統一 Lucide。 -->
