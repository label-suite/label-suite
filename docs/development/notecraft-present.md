---
title: NoteCraft 筆記轉簡報規範
description: docs/ 的筆記如何轉成 16:9 簡報、deck 的命名與 slug 規則、三層驗證歸屬，以及升級 notecraftapp 時要重對的事。
tags: [notecraft, docs]
---

# NoteCraft 筆記轉簡報規範

一篇筆記可以轉成一份 16:9 多頁簡報（deck），在 `/present/<slug>` 檢視與全螢幕播放，
筆記裡既有的 `@ai-visualize` 互動元件原樣嵌入、播放時仍可操作。

播放與渲染是 `notecraftapp` 內建的；生成端是 `content-present` skill，於 [#313](https://github.com/label-suite/label-suite/issues/313) 安裝。
**本專案目前還沒有任何 deck**（`.notecraft/components/` 下沒有 `*.deck.tsx`）。
視覺 token 依 `label-suite-design` skill，文件語法見 [notecraft-writing.md](notecraft-writing.md)，
筆記內的視覺化元件見 [notecraft-visualize.md](notecraft-visualize.md)。

## 怎麼觸發

- 在對話裡說「把 `docs/development/agent-rules.md` 轉成簡報」「重新生成 xxx 的簡報」
- 或在筆記頁按「生成簡報」，它會把提示詞複製到剪貼簿，貼進對話即可。**這顆按鈕只在 dev 模式出現**，也就是 `pnpm exec notecraftapp view docs`（astro dev）；`pnpm docs:serve` 服務的是 build 產物，不會顯示它
- 已經有 deck 的筆記，頁首那顆按鈕會變成「簡報」，直接連到 `/present/<slug>`（這顆不分 dev 與正式）

## 產物與命名

一篇筆記至多一份 deck，一份 deck 一個檔。`docs/` 的筆記都在子資料夾裡，所以**檔名與 `slug` 要分開看**：

| 項目 | 規則 | 例（`docs/development/agent-rules.md`） |
|---|---|---|
| deck 檔名 | **攤平**放在專案根的 `.notecraft/components/` | `.notecraft/components/agent-rules.deck.tsx` |
| `slug` 欄位 | **帶資料夾**，等於筆記頁網址的 slug | `development/agent-rules` |
| `source` 欄位 | 筆記的專案相對路徑 | `docs/development/agent-rules.md` |

路由 `/present/<slug>` 與筆記頁、抽屜裡的「簡報」入口都只比對 `slug` 欄位，
**檔名不參與比對**；檔名要攤平是因為 viewer 以 `@notes/components/*.deck.tsx` 這個 glob 掃 deck，不掃子資料夾。
兩個資料夾有同名筆記時，檔名加上層資料夾（`development-agent-rules.deck.tsx`），`slug` 照舊。

## 版型與原子

- 6 種版型：`cover`、`section`、`custom`、`full-visual`、`quote`、`closing`。`custom` 是內容頁主力
- 內容頁的預設是**挑一個整頁級原子、把資料填進去**，不是每頁重新設計版面；29 個原子的判準、必填欄位與容量上限在 `.claude/skills/content-present/references/atoms.md`
- `cover`／`section`／`quote`／`closing`／`full-visual` **只填欄位、不寫樣式**；`custom` 可以寫版面，但只能組合原子層
- 顏色一律從 deck 的 `dkt(dark)` 取、字級一律用 `DS.*`：**不硬編色碼、不寫字面字級、不用 emoji**
- 既有的 `@ai-visualize` 元件：原樣沿用走 `full-visual`；要加簡報用的排版走 `custom` + 頁內 `import`（外框用 `CanvasViewport`）
- 3D（`three`）元件只能放 `full-visual`，不放 `custom`（縮覽側欄會同時掛十幾頁，每頁一個 WebGL context 會撞瀏覽器上限）

## 誰做哪一層驗證

**三層都要過，但不是同一個人做。**

| 層 | 內容 | Claude Code | Codex |
|---|---|---|---|
| 1. build | deck 進得了 build | `slide-generator` | 自己 |
| 2. 溢出偵測 | dev console 的 `[deck]` 警告與畫面紅框 | 主 Agent | 自己，或請維護者代看 |
| 3. 逐頁截圖 | 內容被裁、疊字、大片空白、亮暗兩主題 | 主 Agent | 自己，或請維護者代看 |

第 1 層在本專案**不是** `tsc` 或 `astro build`（notesDir 只是筆記資料夾，這兩個指令必定失敗），而是：
維護者開著 `pnpm docs:serve` 時看它的背景 rebuild；沒開才跑 `pnpm exec notecraftapp build docs --rebuild`。
`.notecraft/components/` 下的檔案不在 build 的快取失效判斷內（它只掃 notesDir 的 md/mdx 與資料 json、`.notecraft/plugins/**`、`.notecraft/*.json` 與附件來源），所以手動 build **一定要帶 `--rebuild`**，commit 與否都一樣；**第一次失敗先重跑一次**，
穩定失敗兩次才是真的錯誤（[#172](https://github.com/label-suite/label-suite/issues/172)，判準見 [spec-migration.md §建置閘門要重跑確認](./spec-migration.md#建置閘門要重跑確認)）。
watcher 與手動 build **只能走一條**。

第 2、3 層不能跳過：1600×900 是固定座標系、`overflow: hidden`，**build 綠燈永遠測不到被裁掉的內容**。
檢視模式的縮覽側欄會渲染每一頁，所以一次載入就能收齊全部 `[deck]` 警告，不必逐頁點過去。

## 角色分工

| 角色 | 做什麼 |
|---|---|
| `present-planner`（Claude Code） | 讀筆記與既有元件，產出大綱：頁數、每頁版型與原子、要沿用哪些 viz |
| `slide-generator`（Claude Code） | 依大綱寫 deck 檔，跑第 1 層驗證，失敗自動修最多 3 次 |
| 主 Agent | 第 2、3 層驗證，並回報頁數、版型分布、嵌了哪些元件、修掉什麼 |
| Codex | 沒有 subagent，上面三件事自己依序做；規劃與寫檔仍分兩步 |

## 升級 notecraftapp 時

`content-present`、`present-planner`、`slide-generator` 都是從 `notecraftapp` 內建的 `skill-template/` 複製後改寫的
（版本記在 `.claude/skills/content-present/VERSION`）。`references/atoms.md` 的正文沒有本地化（只換了檔頭註解——上游那段指向本專案不存在的路徑與指令——以及行尾 CRLF → LF），升級時整份重新複製、再套回這兩件事即可；`SKILL.md` 與兩個 agent 檔要重新比對一次上游，把本專案的改寫重套上去：
notesDir 是 `docs/`、設計系統是 `label-suite-design`、第 1 層驗證是 `build docs --rebuild`、Codex 版沒有 subagent。

**不要跑 `notecraftapp init-skill --force`**：它會覆寫本專案已客製的 `content-visualize`，並帶進用不到的 `trendlink-design`。
