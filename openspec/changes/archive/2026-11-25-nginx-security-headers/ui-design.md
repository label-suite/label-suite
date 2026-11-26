# UI Design

本次無 UI 變更：本 change 只動公開入口（前端映像內的 Nginx）回應的安全標頭與其驗證（見 system-analysis §範圍）。標頭對所有角色、所有路徑一致，沒有角色差異、沒有遮蔽或唯讀資料（system-analysis §角色與權限），也沒有任何畫面讀得到它。正式建置目前沒有任何頁面（`frontend/src/app/router.tsx` 的正式路由每個路徑都不渲染內容），開發用的兩頁只在開發模式出現、不經 Nginx。因此本次不新增或修改任何路由、頁面、元件、文案與 token，也不改 `design/prototype/`；`docs/diagrams/architecture/frontend-routes.mdx` 本次無常駐文件異動。

## 給後續畫面的設計約束

下列不是本次的 UI 變更，而是維護者 2026-11-25 在 clarification 裁定的標頭政策（Q2 CSP、Q3 防嵌入）對之後實作畫面的影響。違反政策時使用者看到的都是「瀏覽器靜默拒絕」：元素空白、破圖或樣式失效，畫面上**不會**出現任何錯誤訊息，四種畫面狀態的 error 呈現接不到它，只能靠驗證找出來。

### 已在允許範圍內

政策裁定時已預先放寬，下列規格或 prototype 已定的行為不會被擋，之後實作照原設計做即可：

| 畫面行為                                                      | 依據                                                                                                                                                                                                                                                                 | 允許它的政策                                                                                                              |
| :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| 標記工作區的 PDF 說明檔在彈窗內以同源內嵌框架顯示、不開新分頁 | 規格 04-02 §規格 說明檔案預覽「PDF」列、驗收標準「PDF 不開新分頁」；prototype `design/prototype/pages/annotation/annotation-workspace.html:1168`（`#wsGuidelinePdfModalPreview`，`title="PDF 預覽"`）；`design/system/components/modal.md` 的 `#modal-guideline-pdf` | Q3：`X-Frame-Options: SAMEORIGIN`、`frame-ancestors 'self'`、`frame-src 'self'`。前提是 PDF 由同源提供                    |
| 頭像上傳後即時預覽                                            | `design/system/components/avatar.md`「已上傳」狀態；prototype `pages/account/profile.html:1848` 以 data URL、`components-showcase.html:1626` 以物件網址（blob）預覽                                                                                                  | Q2：`img-src 'self' data: blob:`                                                                                          |
| 彈窗、抽屜、下拉、提示類元件在執行時插入的樣式                | `design/system/components/modal.md`、`tooltip.md`、`toast.md`；shadcn/ui 底層的 `radix-ui`（`frontend/package.json`）在開彈窗鎖捲動等情境插入 `<style>` 元素                                                                                                         | Q2：`style-src 'self' 'unsafe-inline'`。目前 `frontend/src/components/ui/` 尚無彈窗類元件，加入時仍要照下方自我檢查驗一次 |

### 仍受限制

下列情境在現行政策下會被擋；要做就得另開 change 放寬 CSP 或對應的標頭，不能在畫面實作裡繞過：

| 會受影響的畫面行為                                                 | 依據                                                                                                                         | 受哪條政策限制                                                                                | 使用者看到的後果                                                   |
| :----------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| 圖片說明檔與圖片類資料改由外部來源（例如另一個網域的物件儲存）提供 | prototype `annotation-workspace.config.js:6383`（`#modal-guideline-image`）；圖片實際由誰、從哪個來源提供尚未有 api-contract | `img-src 'self' data: blob:` 不含外部來源                                                     | 彈窗與資料圖片破圖                                                 |
| PDF 說明檔改由外部來源提供後再內嵌                                 | 同上表 04-02                                                                                                                 | `frame-src 'self'`                                                                            | 內嵌框架空白或顯示瀏覽器的拒絕頁；規格禁止開新分頁，沒有替代路徑   |
| 設計 token 的字型改由外部字型服務載入                              | `design/prototype/assets/tokens.css:7` 向外部字型服務取字型；前端建置刻意不帶這個請求（`frontend/build/extract-tokens.ts`）  | 字型與外部樣式表都只允許同源                                                                  | 現在無影響；之後若要載入，CSP 未放寬時字型退回系統字型             |
| 用 Google 帳號登入改成頁面內嵌入外部登入元件                       | 規格 01-01 §業務流程；system-analysis §會被後續依賴的                                                                        | CSP：程式、框架與連線來源都只允許同源                                                         | 元件載不出來，登入按鈕區空白或無反應                               |
| 用 Google 帳號登入改成彈出視窗流程                                 | 同上                                                                                                                         | `Cross-Origin-Opener-Policy: same-origin`（Google 建議彈窗流程用 `same-origin-allow-popups`） | 彈窗與本頁的連結被切斷，彈窗內登入完成後本頁收不到結果，停在登入頁 |
| 用 Google 帳號登入改成先送出表單、再由外部導回                     | 同上                                                                                                                         | `form-action 'self'`                                                                          | 表單送不出去，點了登入沒有反應                                     |
| 前端呼叫不同源的 API                                               | 建置參數 `VITE_API_BASE_URL`（Q2 寫明的耦合）                                                                                | `connect-src 'self'`                                                                          | 設成跨源網址時所有 API 呼叫失敗，畫面停在 error 或 loading         |
| 內嵌程式（行內 script、事件屬性）                                  | Q2「程式仍不能內嵌」                                                                                                         | 程式來源只允許同源檔案                                                                        | 該段程式不執行，互動無反應                                         |

Google 登入的三列：現在以整頁導向登入，三者都不受影響；本 change 的標頭值維持不變（維護者已定），日後 01-01 的登入做法若改成上表任一種，要在那個 change 一併放寬對應的標頭。開發伺服器不帶這些標頭（clarification N3），所以這三種破損在開發伺服器上看不出來，只有經過 Nginx 的建置才會出現。

對設計的要求：

- 之後任何引入彈窗類元件、外部圖片或字型來源、內嵌框架、外部登入（內嵌元件、彈出視窗或表單導回），或改動 `VITE_API_BASE_URL` 的前端 change，ui-design 都要把「目前的 CSP 與 `Cross-Origin-Opener-Policy` 是否允許」列入自我檢查，並在 e2e 以瀏覽器主控台沒有 CSP 違規作為斷言之一。開發伺服器不帶 CSP（clarification N3），所以這項檢查只能在經過 Nginx 的建置上做。
- 本 change 不新增 token、不改元件狀態；`design/system/design-gaps.md` 沒有相關登記，上表也不是設計系統的差異，不需登記。
