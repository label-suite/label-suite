# Tasks

## 1. 契約

- [x] 1.1 MODIFIED 的「依分層限制 import 方向」逐字保留主規格原有的**四個** scenario（元件匯入頁面、功能之間互相匯入、頁面繞過功能入口、只有元件展示頁可以讀對照層原文），只新增「分不出層的檔案 lint 失敗」一個；以程式比對確認四個的內容逐字相同
- [x] 1.2 requirement 本文只補一句（分不出層不得跳過檢查），來源行註明那一句出自 #528
- [x] 1.3 `npx openspec validate fix-pages-root-layer-classification --strict` 為 valid

## 2. 實作

- [x] 2.1 `frontend/eslint.config.js` 啟用 `boundaries/no-unknown-files`，並在原地註解寫明為什麼 `boundaries/dependencies` 單獨不夠（分不出層就不判定）
- [x] 2.2 兩個替代改法逐一實測並記進 proposal：`partialMatch: true` 抓不到；在 `pages` 之後多加 `{ type: "pages-root", pattern: "src/pages" }` **抓得到**，但對順序敏感（放在 `pages` 之前會把每個頁面檔吞成 `pages-root`，全專案 27 個錯誤）且只補 `src/pages/` 一層，所以選對所有層一致成立的 `boundaries/no-unknown-files`
- [x] 2.3 `frontend/build/eslint-config.test.ts` 補兩個案例，用**真實檔案**而非 `lintText` 的虛擬路徑——plugin 依磁碟上的路徑分層，不存在的路徑分不出層，而且型別感知的 parser 會對它回一則 `ruleId: null` 的致命錯誤，案例量到的不是被測的行為。測後以 `finally` 清除

## 3. 驗證

- [x] 3.1 `pnpm --filter frontend lint`：全專案 exit 0、零錯誤零警告（啟用新規則後沒有既有檔案被誤抓；`src/main.tsx` 由 `boundaries/files` 的 `app-entry` 承接）
- [x] 3.2 `pnpm --filter frontend exec vitest run build/eslint-config.test.ts`：4 passed
- [x] 3.3 變異測試三種，每種都讓對應的案例變紅、還原後 4 passed：拿掉 `boundaries/no-unknown-files`、把它降成 `warn`（**嚴重度**那一項——`pnpm lint` 是 `eslint .`，警告的 exit 是 0，spec 要求的「lint 失敗」會失效而舊版斷言察覺不到）、以及把 root element 放錯順序造成的過寬退化
- [x] 3.4 `pnpm --filter frontend typecheck`、`pnpm --filter frontend test`、`pnpm --filter frontend build` 通過
- [x] 3.5 `pnpm --filter frontend api:generate` 後 `frontend/src/api/generated` 無漂移
- [x] 3.6 `pnpm check:specs`、`check:flows`、`check:er`、`format:check` 通過
