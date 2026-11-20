# Design System Artifact 的來源檔

`project/` 底下是 claude.ai Design System Artifact 的檔案樹，全部從本 repo 產生：token 來自 `design/prototype/assets/tokens.css`，元件樣式抄自 `design/prototype/pages/shared/*.css` 與 `components-showcase.html` 的正典區塊，品牌手冊與元件說明濃縮自 `design/system/` 的 brand.md、MASTER.md、ux-conventions.md 與 `components/*.md`。

這裡是唯一的來源，單向發布到 <https://claude.ai/artifact/VcrLimidXWTnazY16XTxjj>。不要在 Artifact 頁面上改內容再抄回來；要改就改 repo，再重新發布。`project/design-system.json`、`tokens.css`、`manifest.json` 與 `api/` 由發布端產生，不放在這裡。

## 重新產生 token

`project/tokens.json` 是產生的，不要手改。改了 `tokens.css` 或用途說明之後：

```bash
node scripts/build-design-artifact-tokens.mjs            # 重寫 project/tokens.json
node scripts/build-design-artifact-tokens.mjs --check    # 核對 tokens.css 的每個 --變數都在 tokens.json 裡，或列為略過
node scripts/build-design-artifact-tokens.mjs --contrast # 列出兩種主題的對比值（加 --failing 只列未達標的）
```

- 用途說明寫在 `token-usage.json`，依 MASTER.md 與 brand.md 手寫；腳本會再接上計算出的對比值與 tokens.css 那一行的註解。新增 token 卻沒寫說明、也沒有行內註解時，腳本會停下來。
- `tokens.css` 新增一個不屬於任何既有前綴的變數時，要先在腳本的 `FAMILY_RULES` 指定它屬於哪一族。
- `meta.ref` 取 `origin/main` 上最後一次修改 `tokens.css` 的 commit，所以跑腳本前先 `git fetch origin`。
- 值一律照抄，不重新調色；Artifact 格式存不下的值（`color-mix()`、`calc()`、具名顏色）會列為略過，並記在 `project/README.md` 的「未同步」一節。
