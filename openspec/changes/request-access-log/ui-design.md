# UI Design

本次無 UI 變更：本 change 只動後端的伺服器紀錄，包括每個 `/api/v1` 請求一行的存取紀錄、每一筆紀錄自動帶上 traceId，以及後端的 log 輸出設定（見 system-analysis §範圍）。存取紀錄只寫在伺服器端，產品裡沒有任何畫面或 API 讀得到它（system-analysis §角色與權限）。前端的錯誤畫面與 correlation id 顯示也明列在本次範圍之外。因此本次不新增或修改任何路由、頁面、元件、文案與 token，也不改 `design/prototype/`；`docs/diagrams/architecture/frontend-routes.mdx` 本次無常駐文件異動。
