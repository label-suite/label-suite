# Clarification

## 檢查範圍

關卡模式：`system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`、`proposal.md`。`specs`、`design`、`tasks` 尚未產生，只能對它們檢查的項目標「後續產物」。

主要輸入是 `system-analysis.md` §待決問題的 16 題與 `system-design.md` §本文新發現的待決問題 N1–N5。合併後成為下列 15 個 Q；N5 是技術風險，不需維護者決定，交給 apply 第一個後端群組驗證。

## 檢查結論

| 面向             | 結論                                                                                                                                        | 問題數                                                        |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------ |
| 規格完整性       | 待釐清：#506 的驗收條件 1、6 字句與既有裁定不一致（Q1、Q12）；specs、tasks 涵蓋度為後續產物                                                 | 2                                                             |
| API Contract     | 通過：本次無 API 變更，`api-contract.md` 依規則只有一行；若 Q14 選拆存活端點則需重寫                                                        | 0                                                             |
| 邏輯一致性       | 問題：`system-design.md` 元件清單的 Semgrep regex 未跳脫 `                                                                                  | `，把表格拆成多欄（P1）；B1 例外字句與 #504 Q8 的讀法併入 Q12 | 1   |
| 可行性           | 待釐清：唯一公開入口在不在本次編排（Q2）、根目錄 `setup` 與 pnpm 內建指令撞名（Q11）；N5 為技術風險                                         | 2                                                             |
| 邊界情況         | 通過：缺必要設定拒絕啟動、PostgreSQL 輪 0 skipped、探針殘留、遷移失敗時 backend 不起都有設計                                                | 0                                                             |
| 跨功能影響       | 待釐清：規則文件與 ADR-008、`architecture.mdx` 的改寫範圍（Q12）；`frontend-code-boundaries` 要以 #528 歸檔後的主規格為基準（交給後續產出） | 1                                                             |
| 可測試性         | 待釐清：覆蓋率「不得下降」的基準與誤差未定義（Q7、Q8）；e2e 是否進 CI 決定驗收條件 1 有無機械證據（Q3）                                     | 3                                                             |
| 規格範圍         | 待釐清：相依套件掃描、型別檢查、`/docs` 關閉、access log 是否納入本次（Q4、Q5、Q13、Q15）；不碰 `docs/specs/`、PRD、`design/prototype/`     | 4                                                             |
| 任務設定驅動     | 不適用：本次只動容器、CI、根指令與 e2e 骨架，沒有任務類型相關行為                                                                           | 0                                                             |
| 測試集答案不外露 | 不適用：健康檢查旅程不碰答案資料；`e2e/shared/fixtures/` 不放資料檔（交給後續產出）                                                         | 0                                                             |

## 決議（Q）

> 下列各題的「決議」「理由」「日期」待維護者回覆後補上。建議答案見 #506 的檢查點留言。

### Q1. 驗收條件 1「健康檢查顯示成功」在容器裡驗什麼

- **來源**：system-analysis 待決 #1、需求矛盾 1；system-design D5、D7、D8
- **問題**：健康檢查頁只在開發模式出現（#505 Q1）。(a) 容器以 `docker compose up --wait` 加後端健康檢查回應驗；(b) e2e 在前端開發伺服器驗健康檢查頁；兩者都要或擇一？#506 驗收字句要不要跟著改？
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q2. 編排裡有沒有唯一公開入口（Nginx 反向代理）

- **來源**：system-analysis 待決 #2、需求矛盾 5、6；system-design D6 選項 A／B
- **問題**：選項 A：前端容器（nginx:alpine 服務正式建置）與 backend 各自對外；選項 B：前端 nginx 同時反向代理 `/api`，只有它對外（ADR-008 D1）。正式層是否同樣排除 Redis 與 worker？
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q3. e2e 要不要每張 PR 在 CI 跑

- **來源**：system-analysis 待決 #3；system-design D8、CI job 表的 `e2e`
- **問題**：每張 PR 跑（SQLite、開發伺服器），或本次只建骨架與本機指令？
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q4. 前端型別檢查、後端 ruff 與 mypy --strict 進不進 CI

- **來源**：system-analysis 待決 #4、需求矛盾 3；`backend-skeleton/clarification.md` Q6
- **問題**：進 CI 等於推翻 #504 Q6「不加 CI job」；不進則仍靠本機自律。
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q5. 相依套件掃描這次要不要一起接

- **來源**：system-analysis 待決 #5、需求矛盾 2；ADR-008 D8；system-design CI job 表的 `dependency-audit`
- **問題**：ADR-008 D8 決定「先做相依套件掃描」，#506 卻只列 Semgrep。
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q6. Semgrep 違規時失敗還是只回報；規則集與範圍

- **來源**：system-analysis 待決 #6；system-design `semgrep` 序列圖
- **問題**：失敗（`--error`）或只執行並回報？只用兩條專案禁令，還是加註冊表規則集？掃前後端與 e2e，還是只掃後端？
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q7. 覆蓋率「不得下降」的基準怎麼定

- **來源**：system-analysis 待決 #7；system-design D12、N2
- **問題**：(a) 和 PR base 分支在 CI 上量到的值比，或 (b) 和 repo 裡的 `coverage-baseline.json` 比、上升時更新；容許誤差多少；前後端各一個基準還是只管後端；初始值取本 PR 在 CI 上第一次量到的值，還是 acceptance 記的數字；五項關鍵路徑 90% 要不要先留位置？
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q8. 前端覆蓋率分母要不要涵蓋所有原始碼

- **來源**：system-analysis 待決 #8；`frontend-skeleton/acceptance.md` 第 254 行；system-design D12
- **問題**：目前分母只含被測試載入過的檔案，新增一個完全沒測的檔案不會讓覆蓋率下降。
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q9. CI 依變更路徑跳過 job 嗎（含 compose job）

- **來源**：system-analysis 待決 #9；system-design D13、N4
- **問題**：`hashFiles()` 在兩層都存在後恆真。改成「這次有改到該層才跑」嗎？`compose` job 要建兩個映像、耗時數分鐘：每張 PR 跑、只在動到編排檔或 Dockerfile 時跑，還是只在本機與驗收時跑？
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q10. 新 CI job 哪些列為 `main` 必過檢查、何時改 ruleset

- **來源**：system-analysis 待決 #10；#509
- **問題**：驗收條件 2–4 寫「CI 失敗」，但不是必過檢查時 PR 仍能合併；ruleset 只有維護者能改。
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q11. 根目錄 setup、dev、check 的語意與 setup 撞名

- **來源**：system-analysis 待決 #11；system-design N1、§本機自查的步驟
- **問題**：setup 包住 `scripts/setup.sh` 再裝前後端依賴，還是取代它？`pnpm setup` 是 pnpm 內建指令，保留名字並一律寫 `pnpm run setup`，還是改名（如 `bootstrap`）？dev 起本機開發伺服器還是容器？check 是否在沒有 `TEST_DATABASE_URL` 時明確印出已跳過 PostgreSQL 輪？
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q12. 驗收條件 6 的文件改寫範圍

- **來源**：system-analysis 待決 #12、#13、需求矛盾 4、7、8、9；system-design N3
- **問題**：(a) 只改本次建成的檢查；(b) 連 #504、#505 已在本機建成的 F1、F2、F3、A5、B2 一起改；(c) 改掉各規則文件開頭與 `AGENTS.md` 「`backend/`、`frontend/`、`e2e/` 目前不存在」的過時敘述（與 #523 重疊）；(d) ADR-008 D8、`architecture.mdx` 的「Semgrep 延後」與備援列（N3）；(e) T9「七項全歸 #111」的歸屬字句與 #111 §2b 的覆蓋率項；(f) B1 §例外 補一句健康檢查模組仍是分層檢查對象。
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q13. 正式層要不要關閉後端內建 API 文件與介面描述路由

- **來源**：system-analysis 待決 #14；`backend-skeleton/clarification.md` N6
- **問題**：關閉要新增一項設定，牽動 `runtime-config`「其餘設定都有預設值」。
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q14. 容器健康檢查的輪詢頻率，要不要拆不碰資料庫的存活端點

- **來源**：system-analysis 待決 #15；system-design D5
- **問題**：本文預設 30 秒、不拆端點；拆端點會新增一個 API 與一條 spec delta。
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

### Q15. 後端 access log 格式在本次定還是留給 01-01

- **來源**：system-analysis 待決 #16；`backend-skeleton/acceptance.md` 附註 3；S9
- **問題**：目前存取紀錄印出完整查詢字串；Lite 層的 log 視為敏感（ADR-008 D3）。
- **決議**：
- **理由**：
- **已回修**：
- **日期**：

## 已修正（P）

| 編號 | 位置                                                                    | 問題                 | 修正   |
| :--- | :---------------------------------------------------------------------- | :------------------- | :----- |
| P1   | `system-design.md` §元件清單 `.semgrep/label-suite.yml` 列（第 161 行） | regex `(?i)(api_?key | secret | token | password)`的` | ` 沒有跳脫，表格被拆成多欄，後兩欄的內容錯位 | 退回 `sd`：把 ` | `寫成`\|`，或把 regex 移出表格改寫在 D 段 |

## 交給後續產出

- specs、design、tasks 依上列 Q 的決議撰寫；任一 Q 未決前不產生 specs。
- `frontend-code-boundaries` 的 delta 以 #528 `fix-pages-root-layer-classification` 歸檔後的主規格為基準。
- 不改 `docs/specs/`、`docs/specs/00-prd.mdx`、`design/prototype/`；ruleset 變更不在本 change 內執行。
- N5（`import-linter` 萬用字元支援）放在 apply 第一個後端群組先驗證，不支援時改用逐模組產生契約的 unit 測試。
- 每條 requirement 追溯到 ADR 與規則文件條號（spec-migration D4，#503 裁定）。
- `e2e/shared/fixtures/` 不放任何資料檔，健康檢查旅程不碰答案資料（Hard Rule 6）。
