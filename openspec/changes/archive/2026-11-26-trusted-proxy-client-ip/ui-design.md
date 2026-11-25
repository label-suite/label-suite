# UI Design

本次無 UI 變更。

理由：本 change 只讓後端在 Nginx 後面採信受信任代理送來的來源位址，範圍是後端啟動設定、`frontend/nginx.conf` 的標頭核對、`.env.example`、兩份編排檔與 `architecture.mdx` §部署與維運；`system-analysis.md` §範圍明寫「畫面：本 change 沒有使用者可見的畫面」，因此不新增或修改任何頁面、路由、元件、資料區塊或畫面狀態（四種狀態、遮蔽欄位與 design token 皆不適用）。若待決項的裁定帶出使用者可見的呈現（例如登入被限流時的提示），那會是另一個 change 的範圍，屆時再重新產出本份文件。
