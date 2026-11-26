# API Contract

本次無 API 變更。

沒有新增、修改或移除任何端點；`backend/openapi.json` 不變，前端 `pnpm --filter frontend api:generate` 不需要重跑。信任反向代理只改變請求進入應用程式時 `scope["client"]` 與 `scope["scheme"]` 的值，沒有任何路由、錯誤碼、授權或回應欄位因此改變，所以 `error-codes.mdx` 與 `endpoint-authorization.mdx` 也沒有異動。測試用的探針路由只在 `backend/tests/` 內掛上，不出現在匯出的契約。
