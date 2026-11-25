# Clarification：nginx-security-headers

關卡模式，檢查 system-analysis、system-design、ui-design、api-contract、proposal 五份產出；specs、design、tasks 尚未產生，相關檢查項標「後續產物」。來源 issue #568。

## 檢查結論

| #   | 面向             | 結論   | 說明                                                                                                                                                                                           |
| :-- | :--------------- | :----- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 規格完整性       | 待釐清 | issue 的前提「repo 裡還沒有 Nginx 設定」已過時：#506 交付了 `frontend/nginx.conf`、五個安全標頭與「只有 frontend 發布埠」（已有 CI 斷言）。驗收條件 1 已成立；其餘的 CSP、HSTS、驗證列為 Q1–Q5 |
| 2   | API Contract     | 通過   | 標頭屬傳輸層，`openapi.json` 與 Orval 產物不變                                                                                                                                                 |
| 3   | 邏輯一致性       | 問題   | system-analysis 與 system-design 的基準 commit 不同、待決題數寫成 1–9（P1）；PDF 預覽在「完全禁止嵌入」下的後路兩份說法不同、頭像預覽沒進 CSP 的選項說明（Q2、Q3 已一併呈現）                  |
| 4   | 可行性           | 通過   | `sd` 以拋棄式 project 實測 Lite 層：九類回應都帶齊五個標頭；正式建置在只允許同源的 CSP 下 Chromium 違規 0 次                                                                                   |
| 5   | 邊界情況         | 待釐清 | 後端錯誤、Nginx 自己的 405、後端停掉後的 502 都要帶標頭；開發伺服器不帶 CSP（N3）；邊緣代理可能改寫標頭（N4）                                                                                  |
| 6   | 跨功能影響       | 待釐清 | 兩層共用同一份 `nginx.conf`；與 #566 改同一個檔（Q6）；CSP 牽動 04-02 PDF 預覽、頭像預覽、彈窗元件（Q2、Q3）；ADR-004 D7 全域限流（Q8）                                                        |
| 7   | 可測試性         | 待釐清 | 「CSP 不擋前端」只有瀏覽器證明得了，e2e 不經 Nginx（Q4）；正式建置沒有頁面，「首頁正常」要另定判準（Q5）                                                                                       |
| 8   | 規格範圍         | 待釐清 | 是否補回 `docs/specs/`（Q9）；不改 `00-prd.mdx`、`design/prototype/`                                                                                                                           |
| 9   | 任務設定驅動     | 通過   | 只動 Nginx 設定、驗證腳本與 CI，沒有任務類型的分支                                                                                                                                             |
| 10  | 測試集答案不外露 | 通過   | 標頭對所有角色一致，不帶任何資料；CSP 是防 XSS 的第二道防線，補強而不取代答案隔離與輸出轉義                                                                                                    |

## 待釐清項目（Q）

以下全部由維護者 2026-11-25 在本停點以問答逐題裁定；提問時附的選項與後果取自 system-design §技術待決問題與 ui-design 的設計約束。

| #       | 題目                               | 決議                                                                                                                                                                                                                                                                                    | 理由                                                                                             |
| :------ | :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| Q1      | HSTS                               | **Nginx 不發，交給前面的 TLS 邊緣**；驗證腳本斷言回應**不帶** `Strict-Transport-Security`                                                                                                                                                                                               | 條件式發送要信任 `X-Forwarded-Proto`（屬 #566）；無條件發送在 Cloudflare 後面會替整個網域下 HSTS |
| Q2      | CSP 政策                           | **強制模式、不收違規回報**；同源為主：`default-src 'self'`、`style-src 'self' 'unsafe-inline'`、`img-src 'self' data: blob:`、`object-src 'none'`、`base-uri 'self'`、`form-action 'self'`，其餘依 sd 設計取 `'self'`；`connect-src 'self'` 並寫明與建置參數 `VITE_API_BASE_URL` 的耦合 | 現在的建置在全同源下不違規；樣式與圖片預先放寬，彈窗類元件與頭像預覽日後不會壞；程式仍不能內嵌   |
| Q3      | 防嵌入                             | **允許同源**：`X-Frame-Options: SAMEORIGIN` 與 `frame-ancestors 'self'` 並存且一致；嵌入框架來源 `frame-src 'self'`                                                                                                                                                                     | 規格 04-02 的 PDF 說明檔要在頁面內以同源 iframe 顯示且禁止開新分頁；別的網站仍嵌不進來           |
| Q3-附   | #506 多加的三項是否列入契約        | **列入**：`Cross-Origin-Opener-Policy`、`Permissions-Policy`、`server_tokens off`（`Server` 不帶版本）一起由驗證腳本比對                                                                                                                                                                | 已在用，列入後被拿掉或改值會被擋下                                                               |
| Q4      | 驗證位置                           | **腳本加瀏覽器檢查，都放 CI `compose` job，不列必過**；腳本比對六類回應的完整標頭值                                                                                                                                                                                                     | `compose` 依路徑觸發，列必過會卡住沒動到它的 PR                                                  |
| Q5      | 「首頁正常」的判準                 | **頁面殼與建置資源回 200、CSP 違規 0 次、請求失敗 0 次、同源 API 呼叫成功**                                                                                                                                                                                                             | 不依賴頁面內容，日後有頁面也適用                                                                 |
| Q6／Q7  | 標頭歸屬與 #566 的分界             | **維持現況**：前端映像內的 Nginx、兩層都生效、後端不發安全標頭；本 change **不碰**轉發標頭與代理信任，全留給 #566                                                                                                                                                                       | Q1 不發 HSTS，兩張沒有相依                                                                       |
| Q8／Q10 | 全域限流與 issue 本文              | **限流不做**；主 session 在 #568 **留言**說明 #506 已交付的部分與驗收條件 1 的既有證據，**不改寫本文**                                                                                                                                                                                  | 限流要先有正確的來源 IP（#566），不在本 change                                                   |
| Q9      | 是否補回 `docs/specs/`             | **不補**                                                                                                                                                                                                                                                                                | 技術 change，依 spec-migration D4 追溯；比照 request-access-log Q13                              |
| N1      | `/assets/missing.js` 回 200 頁面殼 | **不在本 change**，寫進 PR 的非阻擋                                                                                                                                                                                                                                                     | 一張 PR 一個目的                                                                                 |

## 明確問題（P）

### P1. 基準 commit 與待決題數

- **位置**：system-analysis 以 `c2ccf7a` 為基準、system-design 以 `f7db41f` 實測；system-analysis §角色與權限寫「待決 1–9」，表有 1–10
- **修正**：派 `sa` 統一基準為 `f7db41f`（兩者間 `frontend/nginx.conf`、`e2e/`、`router.tsx` 無差異）並改成 1–10，待決改成決議

### P2. 上游產出的待決改成決議

- **修正**：`sa`、`sd`、`ui-ux`、`planner` 各自依上表改寫並標回修位置；ui-design 的「給後續畫面的設計約束」依 Q2、Q3 更新（PDF 同源嵌入、頭像預覽、彈窗元件現在都在允許範圍內）

### P3. CI 觸發清單（system-design N2）

- **修正**：tasks 把新驗證腳本的路徑加進 `scripts/ci-changed-paths.mjs` 的 `compose` 觸發清單，否則只改腳本的 PR 不會跑 `compose`

## 交給後續產出

- **specs**：新增 capability `security-headers`（每一類回應帶同一組標頭且值完全相符、與角色或登入無關；Q2 的 CSP；Q3 的防嵌入與三項附加標頭；Q1 不帶 HSTS；Q5 的「首頁正常」判準）；`ci-quality-gates` MODIFIED（觸發路徑含驗證腳本、`compose` 的步驟與失敗條件加標頭檢查與瀏覽器檢查）；`container-runtime`、`e2e-testing` 依 Q4、Q6 判斷是否需要 delta 並寫明理由。來源：issue #568、ADR-008 D1／D2、ADR-004 D7、security-agent-rules S2／S9、Hard Rule 9、archive `infra-compose-e2e-ci` Q2／Q3／Q10、本文件的 Q 編號
- **design**：上表的決議；標頭都在 server 層級加 `always`；期望值只寫在驗證腳本一處
- **tasks**：`frontend/nginx.conf` 加 CSP、改 `X-Frame-Options`；新驗證腳本（六類回應完整值比對，含後端 404 envelope、Nginx 自己的 405、後端停掉後的 502、不帶 HSTS）；瀏覽器檢查；CI `compose` job 與觸發清單；`architecture.mdx` §部署與維運寫實際的檢查方式；`backend-modules.mdx` §已知限制「Nginx 與安全標頭」那一列在實作組刪除；N3（開發伺服器不帶 CSP）、N4（邊緣代理可能改寫標頭，部署後要自查）寫進文件
- **範圍外**：轉發標頭與代理信任（#566）；全域限流；`/assets/` 不存在資源的 404（N1）
