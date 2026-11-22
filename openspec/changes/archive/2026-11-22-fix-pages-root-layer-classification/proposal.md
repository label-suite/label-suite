# Proposal

## Why

`openspec/specs/frontend-code-boundaries` 的「依分層限制 import 方向」要求**前端原始碼**依層分，違反時 lint 失敗。但 `frontend/eslint.config.js` 的分層判定漏掉一種位置：直接放在 `src/pages/` 根層的檔案。

`boundaries/elements` 把 `pages` 定義成 `{ pattern: "src/pages/*", capture: ["page"], partialMatch: false }`——那個 `*` 指的是**頁面資料夾**，所以 `src/pages/foo.tsx` 不符合任何 element。而 `boundaries/dependencies` 只判定它分得出層的檔案，於是根層檔案不是「被允許」，是**完全沒有被判定**。

實測（2026-11-21，同一個違規 import：頁面直接取用功能的內部檔）：

| 檔案位置                         | `pnpm --filter frontend exec eslint`       |
| :------------------------------- | :----------------------------------------- |
| `src/pages/_probe-root.tsx`      | exit 0，**零錯誤**                         |
| `src/pages/_probe-dir/index.tsx` | exit 1，`boundaries/dependencies` 指出違規 |

`frontend/src/pages/` 目前只有 `dev-gallery` 與 `dev-health` 兩個資料夾，沒有根層檔案，所以**現在沒有實際違規**；這是一道張著的洞，不是正在發生的缺陷。

來源：[#528](https://github.com/label-suite/label-suite/issues/528)（#505 驗收的「其他發現」，Medium）。

## What Changes

- `frontend/eslint.config.js` 啟用 `boundaries/no-unknown-files`：分不出層的檔案直接報錯並指名該檔。
- `frontend/build/eslint-config.test.ts` 補兩個案例，用**真實檔案**鎖住這條（見下）。
- `openspec/specs/frontend-code-boundaries` 的該 requirement 補一個 scenario，把這個位置寫進契約。

**不改** element 的 pattern，但那不是因為 pattern 改不動。兩個替代改法都實測過（2026-11-21）：

| 替代改法                                                                                    | 實測                                                                                      |
| :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------- |
| `partialMatch: true`                                                                        | **抓不到**根層檔案（exit 0）                                                              |
| 在 `pages` **之後**多加 `{ type: "pages-root", pattern: "src/pages", partialMatch: false }` | **抓得到**（exit 1，`boundaries/dependencies` 指出 `pages-root may not import features`） |
| 同一條 element 放在 `pages` **之前**                                                        | 全專案 **27 個錯誤**——它把每個頁面檔都吞成 `pages-root`                                   |

所以 pattern 比對**可以**解掉這個洞。選 `boundaries/no-unknown-files` 的理由是另外兩點：那條 element **對順序敏感**（放錯位置就誤抓整個 `src/pages/`，而順序在設定裡看不出有這個效果），而且它**只補 `src/pages/` 一層**——其他層的同類洞還在。`no-unknown-files` 對任何分不出層的位置一致成立，與那條 requirement 的範圍相同。

**為什麼選涵蓋而不是禁止。** 本單的工作項寫「涵蓋根層檔案（**或**明確禁止在根層放檔案）」。選涵蓋：主規格已經要求所有前端原始碼分層，涵蓋讓那條既有要求對這個位置生效；禁止則是新增一條規格沒有的禁令。`boundaries/no-unknown-files` 也不只管 `src/pages/`，它對任何分不出層的位置都成立，與那條 requirement 的範圍一致。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `frontend-code-boundaries`：「依分層限制 import 方向」補一個 scenario，不改 requirement 本文。

## Impact

- 全專案 lint 實測：啟用後 `pnpm --filter frontend exec eslint .` exit 0、零錯誤零警告，只有刻意放的探針被抓到。`src/main.tsx` 不受影響，它由 `boundaries/files` 的 `app-entry` 分類承接。
- 不影響執行期行為、API 或相依套件。
- 之後新增一層（例如 `src/hooks/`）時，要記得在 `boundaries/elements` 補上，否則整層會被這條規則擋下——這是這個改動刻意要的效果。**同樣會被擋的是放在 `src/` 根層的宣告檔**（例如 Vite 樣板慣例的 `src/vite-env.d.ts`）：本 repo 目前沒有這種檔（型別放在 `build/virtual-design-tokens.d.ts`），將來要加的話，比照 `src/main.tsx` 用 `boundaries/files` 給它一個分類，不要關掉這條規則。
