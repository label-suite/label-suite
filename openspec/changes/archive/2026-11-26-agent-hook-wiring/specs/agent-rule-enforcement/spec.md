# Spec Delta

## Purpose

定義本 repo 已核准的規則在什麼時機被自動執行、由哪一支共用檢查器判斷、判定結果怎麼回報給人與 agent、哪些情況阻擋哪些只提醒，以及兩個 agent 平台接不住的能力由誰承接。規則內容本身仍只在 `AGENTS.md`，本 capability 不產生任何新規則。

## ADDED Requirements

### Requirement: 規則判定一律來自共用檢查器

系統 SHALL 讓每個觸發點（agent hook、Git hook、手動指令、CI）對同一份輸入得到同一個判定，判定 MUST 由共用檢查器產生。觸發層 MUST NOT 自行判斷規則內容，也 MUST NOT 改寫檢查器的判定。

來源：#111 §需求目標、§2 第 2 項；契約 §邊界「不是規則來源」。

#### Scenario: 同一輸入在 hook 與手動執行得到相同判定

- **WHEN** 同一份檔案內容分別經由編輯後事件（H3）與人工直接呼叫共用檢查器判定
- **THEN** 兩次得到相同的通過／不通過結論與相同的診斷內容

#### Scenario: 觸發層不另作規則判斷

- **WHEN** 共用檢查器對某個命令回報通過
- **THEN** 觸發層放行該命令，不以自身的額外條件改判為阻擋

### Requirement: 事件觸發點以事件提供的工作目錄定位 repo

系統 SHALL 以事件 payload 提供的工作目錄定位目標 repo，MUST NOT 寫死絕對路徑，也 MUST NOT 以目前 shell 的另一個 checkout 代替事件的 workspace。子目錄執行、Git worktree，以及含空白或非 ASCII 字元的路徑 MUST 都得到正確結果。

來源：契約 §Repo 定位；#111 §1 第 3 項。

#### Scenario: 從子目錄觸發

- **WHEN** 事件的工作目錄是 repo 下的子目錄
- **THEN** 檢查範圍與判定與從 repo 根觸發時相同

#### Scenario: 在 worktree 中觸發

- **WHEN** 事件的工作目錄位於某個 Git worktree
- **THEN** 判定對象是該 worktree 的內容，不是主 checkout 的內容

#### Scenario: 路徑含空白與中文

- **WHEN** 事件的工作目錄路徑含空白字元與中文字元
- **THEN** 檢查正常完成，不因路徑被拆開而誤判或失敗

### Requirement: 事件輸入須先驗證且不經由 shell 拼接執行

系統 SHALL 在使用事件 payload 之前驗證其結構與必要欄位，並將命令與參數以不經 shell 重新解析的方式傳遞。路徑 MUST 正規化並限制在事件 workspace 範圍內；超出範圍的路徑 MUST 被視為不適用而非被檢查或被寫入。

來源：#111 §5 第 1 項。

#### Scenario: payload 缺少必要欄位

- **WHEN** 事件 payload 缺少判定所需的欄位
- **THEN** 系統回報輸入不合法，且不把該次事件當成通過

#### Scenario: 路徑指向 workspace 之外

- **WHEN** payload 的檔案路徑經正規化後落在事件 workspace 之外
- **THEN** 系統不對該路徑執行檢查，並在輸出中註明該路徑被排除的原因

### Requirement: 無法判斷不得回報為通過

系統 SHALL 把 malformed JSON、未知事件、共用檢查器不存在或不可執行、執行中斷、非預期的非零退出與超出上限的輸出，一律視為「無法判斷」，MUST NOT 回報為通過。阻擋型觸發點（H2、H4、H6、H7）在無法判斷時 MUST 以阻擋的退出碼結束；提醒型觸發點 MUST 在輸出中明寫哪一項沒有判定成功。

平台官方文件已記載**不存在**的輸入（例如 patch 工具的事件裡沒有寫入路徑欄位）MUST NOT 被歸為「無法判斷」：那是已知的能力缺口，依「寫檔攔截不得被宣稱已覆蓋所有寫入途徑」回報缺口並放行，而不是以阻擋的退出碼結束。

來源：#111 §5 第 2 項；契約 §H2「缺工具／無適用檔案」、§能力缺口與承接第 5 條；缺口與無法判斷的分界為**維護者 2026-11-17 裁定**（見「寫檔攔截不得被宣稱已覆蓋所有寫入途徑」）；Claude 的 H2 另加 `onFailure: "block"` 為**維護者 2026-11-26 決定**（ADR-001 D5），依據是 Claude Code 2.1.323 的本機實測。

#### Scenario: H2 的共用檢查器不存在

- **WHEN** 工具執行前事件（H2）觸發，但要呼叫的共用檢查器不存在或不可執行
- **THEN** 該次工具呼叫被拒絕（exit `2`），stderr 說明檢查器無法執行

#### Scenario: Claude 的 H2 註冊指向的腳本本身無法執行

- **WHEN** 在 Claude Code，H2 的 handler 指向不存在的腳本，或腳本以 `0`、`2` 以外的退出碼結束
- **THEN** 該次工具呼叫被拒絕，因為 `.claude/settings.json` 的兩個 H2 handler 設有 `onFailure: "block"`
- **AND** Codex 沒有等價欄位，`.codex/hooks.json` 不設；同樣的失敗在 Codex 放行，契約與 ADR-001 D5 明寫這個不對稱

#### Scenario: 事件 payload 不是合法 JSON

- **WHEN** 觸發點收到無法解析的 payload
- **THEN** 系統不把該次事件判為通過，並回報 payload 無法解析

#### Scenario: 提醒型觸發點的檢查中斷

- **WHEN** 編輯後事件（H3）的某一項檢查中途失敗
- **THEN** 輸出明列該項未完成，而不是只回報其餘項目通過

### Requirement: 執行時間與輸出大小有上限且由平台設定控制

系統 SHALL 以平台 hook 設定宣告的 timeout 控制每個 agent 事件觸發點的執行時間，MUST NOT 依賴機器上是否安裝某個 shell timeout 工具。上限為 H1 10 秒、H2 5 秒、H3 30 秒、H6 60 秒。輸出 MUST 有大小上限；超過時 MUST 截斷並註明被截斷，MUST NOT 因此改變判定。**截斷後的輸出 MUST 仍可被完整解碼**，MUST NOT 以不完整的多位元組字元序列結尾。Git hook 與 CI 的時間上限由各自的執行環境控制。

來源：契約 §決策紀錄 2026-11-11（四個 timeout）、§查核方式第 1 點、§H4（**刻意偏離**：契約該格寫「腳本自己設上限」，本條改由執行環境承擔，理由見 design D5，契約回填見 task 7.1）；#111 §5 第 3 項；可解碼一項依契約 §Repo 定位（`cwd` 不得假設為 ASCII）與 2026-11-17 的實測（`completion-report.md` §1.5）。

#### Scenario: H2 在時限內完成判定

- **WHEN** 工具執行前事件（H2）觸發
- **THEN** 判定在 5 秒內結束

#### Scenario: 機器沒有 shell timeout 工具

- **WHEN** 執行環境中不存在 `timeout` 與 `gtimeout`
- **THEN** 各觸發點仍正常完成判定，不出現命令不存在的錯誤

#### Scenario: 輸出超過上限

- **WHEN** 某次檢查產生的診斷超過輸出上限
- **THEN** 輸出被截斷並標示截斷，判定結果與未截斷時相同

#### Scenario: 截斷邊界落在多位元組字元中間

- **WHEN** 某次檢查的診斷超過輸出上限，且上限的位置落在一個多位元組字元的中間
- **THEN** 輸出整段可以被完整解碼，結尾不是不完整的字元序列
- **AND** 截斷標示仍然出現，判定結果與未截斷時相同

### Requirement: 只終止本次觸發所啟動的子程序

系統 SHALL 在收尾時只終止本次觸發點自己啟動的子程序，MUST NOT 終止其他 agent、其他 session 或使用者自行啟動的工作。

來源：#111 §5 第 3 項。

#### Scenario: 檢查逾時收尾

- **WHEN** 某次觸發的檢查逾時被收尾
- **THEN** 只有該次觸發啟動的子程序結束，同時進行中的其他程序不受影響

### Requirement: 本機診斷紀錄只保留脫敏 metadata

若系統保留本機診斷紀錄，它 SHALL 只記錄已脫敏的 metadata，MUST NOT 記錄完整命令參數、token、secret 值、研究資料或對話 transcript。紀錄 MUST 有大小上限、MUST 被版控忽略，且 MUST 與產品的 `audit_events` 分開，不混入產品稽核資料。

來源：#111 §5 第 5 項；契約 §H6（`transcript_path` 只在本機用、不外傳）。

#### Scenario: 擋下含 secret 的命令後寫紀錄

- **WHEN** 一個含 token 值的命令被擋下而系統寫入診斷紀錄
- **THEN** 紀錄中沒有該 token 值，只有事件類型、判定結果與時間

#### Scenario: 診斷紀錄不進版控

- **WHEN** 診斷紀錄已產生
- **THEN** 該紀錄不出現在 `git status` 的未追蹤變更中

### Requirement: Session 開始時回報規則執行環境的現況

系統 SHALL 在 session 開始（啟動、resume、clear、compact、fork）時回報本 checkout 的 Git hook 是否已啟用、規則入口 `AGENTS.md` 是否存在，以及所需工具的版本。這個觸發點（H1）SHALL 一律以 exit `0` 結束、訊息走 stdout，MUST NOT 阻擋 session 開始；缺東西時 MUST 列出缺什麼與怎麼補。

來源：契約 §H1；#111 §2 事件分工表第 1 列。

#### Scenario: H1 在 Git hook 未啟用時提醒

- **WHEN** 本 checkout 尚未啟用 repo 的 Git hook，session 開始
- **THEN** 輸出指出 Git hook 未啟用與補救方式，且 session 照常開始

#### Scenario: H1 在五種 session 起始情境都執行

- **WHEN** session 以啟動、resume、clear、compact、fork 任一方式開始
- **THEN** 每一種都產生環境回報

#### Scenario: H1 不阻擋

- **WHEN** H1 發現多項環境缺失
- **THEN** 退出碼為 `0`，session 仍然開始

### Requirement: Session 開始時回報本次 hook 是否真的會執行

系統 SHALL 在 H1 的輸出中回報本次 session 的 hook 是否實際生效：Claude 側看是否全部停用，Codex 側看 hook 功能是否被關閉、以及本 repo 的 hook 是否已被信任。被跳過時 MUST 明確回報「本次 hook 不會執行」，MUST NOT 讓跳過這件事靜悄悄發生。

來源：契約 §H1、§能力缺口與承接第 1 條；#111 §2 事件分工表第 1 列。

#### Scenario: Claude 側全部停用

- **WHEN** Claude 的設定把所有 hook 停用，session 開始
- **THEN** 輸出明寫本次 hook 不會執行

#### Scenario: Codex 側功能被關閉

- **WHEN** Codex 的 hook 功能被關閉，session 開始
- **THEN** 輸出明寫本次 hook 不會執行

#### Scenario: Codex 的 hook 尚未被信任

- **WHEN** Codex 側的 hook 定義變更後尚未重新信任
- **THEN** 輸出明寫這些 hook 目前被跳過，以及重新信任的方式

### Requirement: Session 開始時核對兩份 hook 註冊設定

系統 SHALL 在 H1 核對 Claude 與 Codex 兩份專案層 hook 註冊設定所指向的目標是否都存在。任一邊指向不存在的目標時，輸出 MUST 指名是哪一份設定、哪一個事件。兩份設定由人手寫維護，系統 MUST NOT 以生成器產生其中任一份。

來源：契約 §H1、§能力缺口與承接第 7 條、§決策紀錄 2026-11-11（不做單一來源生成器）。

#### Scenario: 一邊的設定漏改

- **WHEN** 其中一份註冊設定指向一個不存在的檢查目標，session 開始
- **THEN** 輸出指名該份設定與該事件，並說明缺少什麼

#### Scenario: 兩份設定一致

- **WHEN** 兩份註冊設定指向的目標都存在
- **THEN** 輸出回報兩份設定一致，不產生缺漏訊息

### Requirement: 尚未建立的層標為 not applicable 而不是失敗

系統 SHALL 在 `backend/`、`frontend/` 尚未存在時，把屬於那些層的檢查標為 not applicable，MUST NOT 因此回報失敗或要求建立它們。

來源：契約 §H1、§H6「缺工具／無適用檔案」；#111 §2 事件分工表第 1 列、§4 第 3 項。

#### Scenario: H1 在 backend 尚未存在時

- **WHEN** repo 中沒有 `backend/`，session 開始
- **THEN** 後端相關檢查標為 not applicable，整體回報不是失敗

#### Scenario: H6 在 frontend 尚未存在時

- **WHEN** repo 中沒有 `frontend/`，agent 宣告工作完成
- **THEN** 前端相關的證據項標為 not applicable，不因此擋下

### Requirement: 環境檢查不讀取 secret 檔案的內容

系統 SHALL 在環境檢查中只判斷 secret 類檔案是否存在，MUST NOT 讀取或輸出其內容。

來源：契約 §H1「不讀 `.env` 的值」；#111 §2 事件分工表第 1 列。

#### Scenario: H1 面對存在的 .env

- **WHEN** repo 中存在 `.env`，session 開始
- **THEN** 輸出只說明該檔存在與否，不含其中任何鍵值

### Requirement: 破壞性命令在執行前被拒絕

系統 SHALL 在工具執行前事件（H2）**無條件**拒絕 `AGENTS.md` 硬性規則 10 所列的破壞性命令：`rm -rf`、`git reset --hard`、`git push --force`、`git branch -D`。系統 MUST NOT 嘗試判別維護者是否已確認：因為系統 MUST NOT 自行推定維護者已確認，而任何 agent 送得出來的「已確認」訊號都等於讓 agent 自我授權。已確認後的執行路徑在 hook 之外。拒絕 MUST 以 exit `2` 表達、原因寫 stderr，MUST 發生在命令執行之前，且 MUST NOT 因改用另一個工具呼叫同一個動作就視為已授權。

來源：契約 §H2；#111 §3 第 1 項；`AGENTS.md` Hard Rule 10（規則本身不變，本條只定義 hook 在其中擔任的角色）；**維護者 2026-11-17 裁定**（hook 一律拒絕，已確認的路徑走 hook 之外：維護者自行執行，或暫時停用 hook）。

#### Scenario: H2 擋下 rm -rf

- **WHEN** agent 要執行含 `rm -rf` 的命令
- **THEN** 該次工具呼叫以 exit `2` 被拒絕，stderr 說明觸犯哪一條硬性規則，且檔案沒有被刪除

#### Scenario: H2 擋下 git push --force

- **WHEN** agent 要執行 `git push --force`
- **THEN** 該次工具呼叫被拒絕，遠端沒有被改寫

#### Scenario: H2 不以換工具當作已授權

- **WHEN** 同一個破壞性動作改以另一個工具或另一種寫法送出
- **THEN** 仍然被拒絕，不因為前一次已被擋過就放行

#### Scenario: 已獲維護者確認的破壞性命令仍被拒絕

- **WHEN** 維護者已確認某個破壞性命令，而該命令仍以 agent 的工具呼叫送出
- **THEN** 該次工具呼叫一樣以 exit `2` 被拒絕，系統不以任何「已確認」的宣稱作為放行依據
- **AND** 維護者自行在終端機執行同一個命令時不經過 H2，該途徑不受本條影響

### Requirement: 提交與推送到 main 的目標被拒絕

系統 SHALL 在 H2 拒絕以 `main` 為目標的提交與推送，判定 MUST 涵蓋指定其他工作目錄的呼叫、worktree，以及以 refspec 指定目標分支的寫法。

來源：契約 §H2（硬性規則 2）；#111 §3 第 2 項；`AGENTS.md` Hard Rule 2。

#### Scenario: H2 擋下在 main 上的提交

- **WHEN** 目前分支是 `main`，agent 要執行 `git commit`
- **THEN** 該次工具呼叫被拒絕，沒有產生提交

#### Scenario: H2 擋下以 refspec 指向 main 的推送

- **WHEN** agent 要推送到遠端的 `main`，且目標分支寫在 refspec 中
- **THEN** 該次工具呼叫被拒絕

#### Scenario: H2 擋下指定其他工作目錄的提交

- **WHEN** agent 以指定工作目錄的方式對另一個 checkout 的 `main` 送出提交
- **THEN** 該次工具呼叫被拒絕

### Requirement: 不符本 repo 套件管理方式的安裝命令被拒絕

系統 SHALL 在 H2 拒絕 `pip install` 與 `npm install`，並放行 `uv add` 與 `pnpm add`，以維持 lockfile 同步。

來源：契約 §H2（硬性規則 3）；#111 §3 第 2 項；`AGENTS.md` Hard Rule 3。

#### Scenario: H2 擋下 npm install

- **WHEN** agent 要執行 `npm install <套件>`
- **THEN** 該次工具呼叫被拒絕，stderr 指出本 repo 使用 `pnpm add`

#### Scenario: H2 放行 pnpm add

- **WHEN** agent 要執行 `pnpm add <套件>`
- **THEN** 命令照常執行

### Requirement: 受保護路徑的寫入被拒絕且合法例外放行

系統 SHALL 在 H2 拒絕對 secret 類路徑的寫入：`**/.env`、`**/.env.*`、`*.pem`、`*.key`、`*id_rsa*`、`*credentials.json`。系統 SHALL 放行合法例外：`.env.example` 與其他 `*.example`、`*.pub`，以及測試 fixture 目錄下的假憑證。`docs/specs/00-prd.mdx` MUST NOT 列入受保護清單。本條適用於**事件中帶有寫入路徑的檔案工具**；不帶寫入路徑的 patch 工具依「寫檔攔截不得被宣稱已覆蓋所有寫入途徑」處理。

來源：契約 §H2「適用路徑／角色」、§決策紀錄 2026-11-11（不用 hook 擋 PRD）；#111 §3 第 3 項；`**/.env` 一項為**維護者 2026-11-17 裁定**新增——`**/.env.*` 命中 `.env.local` 與 `config/.env.local`，不命中裸檔名 `.env` 與 `config/.env`（以 git 自身的樣式比對實測）。

#### Scenario: H2 擋下寫入 .env

- **WHEN** agent 要寫入 `.env.local`
- **THEN** 該次寫檔被拒絕，檔案內容沒有改變

#### Scenario: H2 擋下寫入裸檔名 .env

- **WHEN** agent 要寫入 repo 根的 `.env`，或子目錄下的 `config/.env`
- **THEN** 兩者都被拒絕，檔案內容沒有改變
- **AND** 同一組樣式下 `.env.example` 仍然放行

#### Scenario: H2 放行 .env.example

- **WHEN** agent 要寫入 `.env.example`
- **THEN** 寫檔照常執行

#### Scenario: H2 放行測試 fixture 中的假憑證

- **WHEN** agent 要寫入測試 fixture 目錄下的 `*.key`
- **THEN** 寫檔照常執行

#### Scenario: H2 不擋 PRD

- **WHEN** agent 要寫入 `docs/specs/00-prd.mdx`
- **THEN** 寫檔照常執行，H2 不介入

### Requirement: 寫檔攔截不得被宣稱已覆蓋所有寫入途徑

系統 MUST NOT 以檔案工具的攔截宣稱已覆蓋 shell、patch 或其他寫入途徑。在沒有攔截點的途徑上，系統 SHALL 在環境回報與文件中明列該缺口與承接方式，MUST NOT 宣稱兩個平台有等價攔截。

兩個 agent 平台在寫檔目標保護上**不對等**：帶寫入路徑的檔案工具受 hook 層保護；**不帶寫入路徑的 patch 工具 MUST NOT 被宣稱受 hook 層保護**。對後者，系統 SHALL 回報缺口並放行，MUST NOT 以缺少路徑欄位為由阻擋，並 MUST 指名承接者是平台權限層、同時說明本次變更沒有設定它。

來源：契約 §能力缺口與承接第 2、3 條、§工具名稱「既有設定的空轉警告」；#111 §3 第 3 項、§1 第 2 項；不對等一項為**維護者 2026-11-17 裁定**（Codex 的 patch 工具與命令工具共用同一個命令欄位、沒有路徑欄位，比照讀取那一條交由權限層承接；見 design D11）。

#### Scenario: Codex 側沒有讀取攔截點

- **WHEN** 查詢 Codex 側對「讀取 secret 檔案」的攔截能力
- **THEN** 系統回報 hook 層沒有攔截點，並指出承接的機制，而不是宣稱已擋下

#### Scenario: Codex 側沒有寫檔目標保護

- **WHEN** 工具執行前事件（H2）收到 Codex 的 patch 工具呼叫，其輸入只有命令欄位、沒有任何寫入路徑欄位
- **THEN** 該次工具呼叫**不**因缺少路徑欄位被阻擋
- **AND** 輸出明寫 hook 層在這條途徑沒有寫檔目標保護、承接者是平台權限層，且本次變更沒有設定平台權限層

#### Scenario: Claude 的寫檔工具缺少路徑欄位

- **WHEN** 工具執行前事件（H2）收到 Claude 的寫檔工具呼叫，但其輸入缺少本該存在的寫入路徑欄位
- **THEN** 該次工具呼叫以 exit `2` 被拒絕，因為那是無法判斷，不是已記載的平台缺口

#### Scenario: 以 shell 寫入受保護路徑

- **WHEN** 寫入受保護路徑的動作改以 shell 命令送出
- **THEN** 由命令那一組判定處理；系統不宣稱檔案工具那一組已涵蓋這條途徑

### Requirement: 命令比對不得把文件中提到的命令當成執行

系統 SHALL 擋下明顯形式的受禁命令，包含複合命令與常見的引號、參數順序變體；同時 MUST NOT 把 issue 內文、commit 訊息或文件內容中**提到**的命令文字判為正在執行。系統 MUST 在輸出與文件中指出字串比對不是完整的安全邊界，真正的保護在平台權限層與 branch protection。

來源：契約 §能力缺口與承接第 2 條；#111 §3 第 4 項。

#### Scenario: 複合命令中的受禁命令

- **WHEN** agent 要執行把受禁命令接在其他命令後面的複合命令
- **THEN** 該次工具呼叫被拒絕

#### Scenario: commit 訊息中提到受禁命令

- **WHEN** agent 執行的 `git commit` 訊息正文中出現 `rm -rf` 這段文字
- **THEN** 命令照常執行，不被誤判為破壞性操作

#### Scenario: 攔截訊息說明邊界

- **WHEN** H2 擋下一個命令
- **THEN** stderr 的原因同時指出字串比對無法可靠涵蓋的語法類型

### Requirement: 攔截原因與診斷不得回顯 secret 值

系統 SHALL 在攔截原因、診斷輸出與任何回報中遮蔽 secret 值，MUST NOT 把被擋下的命令參數或檔案內容中的憑證原樣輸出。

來源：#111 §3 第 3 項（診斷不得回顯 secret）。

#### Scenario: 含憑證的命令被擋下

- **WHEN** 一個參數中帶有 token 的命令被 H2 擋下
- **THEN** stderr 的原因中該 token 被遮蔽，只保留足以辨識規則的資訊

### Requirement: 編輯後依路徑回報診斷但不阻擋

系統 SHALL 在編輯後事件（H3）對本次受影響的檔案依目錄與副檔名執行對應的快速檢查，診斷走 stderr。H3 SHALL 一律不阻擋：它 MUST NOT 以阻擋的退出碼結束，也 MUST NOT 以替換工具結果的方式把診斷藏起來。真正的 gate 在 H4、H5 與 H7。

來源：契約 §H3、§能力缺口與承接第 4 條；#111 §2 事件分工表第 3 列。

#### Scenario: H3 回報診斷

- **WHEN** agent 編輯了一個有檢查規則的檔案且該檢查不通過
- **THEN** 診斷出現在 stderr，編輯保留，流程繼續

#### Scenario: H3 不撤銷編輯

- **WHEN** H3 的檢查不通過
- **THEN** 檔案內容維持編輯後的樣子，agent 看得到原始工具結果與診斷

### Requirement: 編輯後檢查只涵蓋本次受影響且已存在的檔案

系統 SHALL 把 H3 的檢查範圍限制在本次受影響且仍存在的檔案，並排除產生的 API client、資料庫 migration、lockfile 與 vendor 目錄。檔案被刪除或改名時，系統 MUST NOT 對不存在的路徑報錯。本次沒有命中任何檔案時 MUST 標為 not applicable 並以 exit `0` 結束。

來源：契約 §H3「適用路徑／角色」與「缺工具／無適用檔案」；design.md D12（路由以目錄限定）；#111 §4 第 1 項。

#### Scenario: H3 排除產物

- **WHEN** 本次變更只動到產生的 API client 或 lockfile
- **THEN** 不執行對應語言的檢查，結果標為 not applicable

#### Scenario: H3 面對被刪除的檔案

- **WHEN** 本次動作刪除了一個檔案
- **THEN** 不對該路徑執行檢查，也不產生檔案不存在的錯誤

#### Scenario: H3 沒有命中檔案

- **WHEN** 本次變更的檔案都不在任何檢查的範圍內
- **THEN** 標為 not applicable 並以 exit `0` 結束

#### Scenario: 後端或前端副檔名的檔案不在該專案目錄內

- **WHEN** 本次變更含 `.py`、`.ts` 或 `.tsx` 檔案，但它不在 `backend/`（`.py`）或 `frontend/`（`.ts`、`.tsx`）底下，例如 `e2e/`、`.semgrep/`、`.notecraft/` 裡的檔
- **THEN** 不交給該路由的工具，標為 not applicable 並寫明它不在對應的專案目錄內，不回報失敗

### Requirement: 編輯後檢查不改動工作區

系統 SHALL 讓 H3 只回報診斷：它 MUST NOT 修改任何檔案、MUST NOT 自動套用 formatter、MUST NOT 自動將檔案加入 staged 區。要修正由 agent 依診斷自行處理。

來源：契約 §H3「check-only」、§決策紀錄 2026-11-11（H3 只檢查不自動修）；#111 §4 第 2 項。

#### Scenario: H3 不動未暫存的修改

- **WHEN** 工作區存在其他未暫存的修改，H3 因本次編輯而觸發
- **THEN** 那些修改在 H3 執行後完全相同

#### Scenario: H3 不自動暫存

- **WHEN** H3 執行完畢
- **THEN** staged 區的內容與 H3 執行前相同

### Requirement: 缺工具時區分 not applicable 與明確失敗

系統 SHALL 在對應的層尚未 bootstrap、檢查工具自然還不存在時，把該項檢查標為 not applicable；但對**已宣告啟用**的檢查，工具缺失或設定錯誤 MUST 明確失敗，MUST NOT 靜默通過。

來源：契約 §H3「缺工具／無適用檔案」；#111 §4 第 3 項。

#### Scenario: 後端尚未 bootstrap

- **WHEN** repo 中還沒有後端專案，某次變更含後端副檔名的檔案
- **THEN** 該項檢查標為 not applicable，不回報失敗

#### Scenario: 已啟用的檢查缺工具

- **WHEN** 某項檢查已宣告啟用，但其所需工具不存在
- **THEN** 該項明確失敗並指出缺少什麼，不回報為通過

### Requirement: 提交前以 staged 快照判定

系統 SHALL 在 Git `pre-commit`（H4）以索引中的 staged 快照作為判定輸入，MUST NOT 以工作區的檔案內容代替。判定不通過時 MUST 以非零退出碼擋下該次提交。分流規則與 H3 相同。

來源：契約 §H4；#111 §2 事件分工表第 4 列、§4 第 4 項。

#### Scenario: H4 面對部分暫存

- **WHEN** 一個檔案的問題已在工作區修好，但修正沒有被暫存
- **THEN** 提交被擋下，因為 staged 快照仍含該問題

#### Scenario: H4 在子目錄執行

- **WHEN** 在 repo 的子目錄中執行 `git commit`
- **THEN** 判定涵蓋整個 staged 清單，與在 repo 根執行時相同

#### Scenario: H4 擋下提交

- **WHEN** staged 快照中有不通過的檔案
- **THEN** 退出碼非零，提交沒有產生

### Requirement: 提交訊息檢查的現行行為不變

系統 SHALL 維持 Git `commit-msg`（H5）目前的行為：依 `AGENTS.md` §Commits 檢查提交訊息，不通過時以非零退出碼擋下；merge commit 直接通過。本次變更 MUST NOT 另建第二份提交訊息檢查器。

來源：契約 §H5「H5 不改，只記錄」；#111 §現況與參考來源（不另建重複 commit checker）。

#### Scenario: H5 擋下不合格訊息

- **WHEN** 提交訊息不符 `AGENTS.md` §Commits
- **THEN** 退出碼非零，提交沒有產生

#### Scenario: H5 放行 merge commit

- **WHEN** 本次提交是 merge commit
- **THEN** 檢查直接通過

### Requirement: 宣告完成前核對證據

系統 SHALL 在 agent 宣告工作或子任務完成時（H6）核對該跑的驗證是否跑過、證據是否齊全。缺少時 MUST 擋下該次結束，原因 MUST 指名缺哪一項證據。H6 MUST NOT 要求維護者介入，不構成第三個人工停點。

來源：契約 §H6；#111 §2 事件分工表第 5 列。

#### Scenario: H6 擋下缺證據的結束

- **WHEN** agent 在必要驗證未執行的情況下宣告完成
- **THEN** 該次結束被擋下，回饋指名缺少哪一項證據

#### Scenario: H6 不新增人工停點

- **WHEN** H6 擋下一次結束
- **THEN** 回饋直接回到 agent，流程不等待維護者輸入

### Requirement: 證據核對的重複觸發須收斂

系統 SHALL 在因 H6 擋下而再次發生的結束事件上直接放行，MUST NOT 讓同一次擋下反覆觸發自己造成無限重跑。

來源：契約 §H6「阻擋或提醒」（防重入）；#111 §5 第 4 項。

#### Scenario: H6 被擋下後再次結束

- **WHEN** 某次結束已被 H6 擋下，agent 處理後再次結束且該次結束由前一次阻擋所引發
- **THEN** H6 直接放行，不再次擋下

### Requirement: 只重用與目前狀態一致的證據

系統 SHALL 只重用與目前程式碼 snapshot、規則版本與驗證範圍一致的證據；對不上時 MUST 視為沒有證據。

來源：契約 §H6「缺工具／無適用檔案」；#111 §5 第 4 項、§4 第 2 項。

#### Scenario: 證據產生後程式又改動

- **WHEN** 一份驗證證據產生後，受驗證的檔案又被修改，agent 宣告完成
- **THEN** 該份證據被視為無效，結束被擋下

#### Scenario: 證據的驗證範圍不涵蓋本次變更

- **WHEN** 現有證據的驗證範圍不包含本次變更的檔案
- **THEN** 該份證據不被採用

### Requirement: CI 重跑必要檢查並作為合併前的 gate

系統 SHALL 在 pull request 的 CI 以與 H3、H4、H5 相同的共用檢查器重跑必要檢查，判定不通過時 job 失敗。CI MUST NOT 以 not applicable 跳過任何已宣告啟用的必要檢查。本機 hook 通過 MUST NOT 被當成可以取代 CI。

來源：契約 §H7；#111 §2 事件分工表第 6 列、§需求目標。

#### Scenario: 本機 hook 被跳過仍由 CI 判定

- **WHEN** 開發者以跳過 Git hook 的方式提交，或其 agent 平台的 hook 全部停用、或 Codex 的 hook 未被信任而跳過，該變更開成 pull request
- **THEN** CI 仍對同一份內容執行必要檢查，不通過即 job 失敗

#### Scenario: CI 與本機得到相同判定

- **WHEN** 同一份變更在本機被 H4 擋下
- **THEN** CI 對同一份內容也判定不通過

#### Scenario: CI 不跳過已啟用的檢查

- **WHEN** 某項必要檢查已宣告啟用
- **THEN** CI 一定執行它，不以 not applicable 的理由略過

### Requirement: 安裝流程可重複執行且不靜默覆寫既有設定

系統 SHALL 讓安裝流程可重複執行並得到相同結果，沿用 repo 現有的 Git hook 啟用方式。偵測到使用者已有的自訂設定與本 repo 設定衝突時，MUST 回報衝突而 MUST NOT 靜默覆寫使用者層或全域設定。安裝流程 SHALL 提供停用與復原的方法，且停用本機 hook MUST NOT 使 CI 的必要檢查失效。安裝流程 SHALL 另外輸出 Codex 的 hook 信任指引，內容含「未信任時 hook 會被靜默跳過」與重新信任的方式。

來源：#111 §驗收條件第 2 項；契約 §H7、§設定位置（managed／使用者層／專案層）、§待決第 1 題；信任指引一項為**維護者 2026-11-17 裁定**（契約 §待決第 1 題的答案：要寫進安裝流程）。

#### Scenario: 重複執行安裝

- **WHEN** 安裝流程連續執行兩次
- **THEN** 第二次不產生重複設定，結果與第一次相同

#### Scenario: 既有自訂設定衝突

- **WHEN** 使用者已有與本 repo 設定衝突的自訂 hook 設定
- **THEN** 安裝流程回報衝突與處理方式，不覆寫該設定

#### Scenario: 停用本機 hook

- **WHEN** 開發者依提供的方法停用本機 hook
- **THEN** 本機 hook 不再觸發，CI 的必要檢查仍然執行

#### Scenario: 安裝流程輸出 Codex 的 hook 信任指引

- **WHEN** 開發者執行安裝流程
- **THEN** 輸出含一段指引，說明 Codex 使用者必須信任本 repo 的 hook，否則 hook 會被靜默跳過，並寫出重新信任的方式

### Requirement: 文件中的 hook 現況敘述與實際狀態一致

系統 SHALL 在本次變更完成後，使 `docs/development/agent-hook-contract.mdx` 中「待建置」的標記與 `AGENTS.md` §Agent Rules Index 末段的現況敘述反映實際狀態。這些文件 MUST NOT 新增、修改或擴充任何規則；`AGENTS.md` 仍是唯一規則來源。

來源：契約 §邊界「不是規則來源」、各 H 的「待建置」標記；#111 §驗收條件第 1 項（不建立第二份規則 canon）。

#### Scenario: 已建置的檢查不再標待建置

- **WHEN** 某個 hook 的共用檢查器已建置並生效
- **THEN** 契約文件中該項不再標示「待建置」，而是記載現況

#### Scenario: 未建置的項目維持標記

- **WHEN** 某項能力在本次變更後仍未建置
- **THEN** 文件仍標示其未建置，不以設定檔存在或 source 內含關鍵字當成已完成

#### Scenario: 文件更新不新增規則

- **WHEN** 比對本次變更前後的 `AGENTS.md`
- **THEN** 差異只在 hook 現況的敘述，規則條目數量與內容不變

### Requirement: 平台權限層與 hook 攔截分開陳述

系統與文件描述攔截能力時 MUST 指明是 hook 層還是平台權限層，MUST NOT 以其中一層的能力代稱另一層。

來源：契約 §能力缺口與承接第 3、6 條、§邊界「hook 不等於權限控制」；#111 §3 第 6 項；proposal §前置查核（2026-11-17 的查核紀錄與網址）。

#### Scenario: 描述攔截能力時指明層級

- **WHEN** 任何產出要主張某個動作被擋下
- **THEN** 指明是 hook 層還是權限層，且不以其中一層的能力代稱另一層

#### Scenario: Codex 兩套機制不混用

- **WHEN** 描述 Codex 側的權限設定
- **THEN** 以 permission profile 與 sandbox 設定互斥的事實陳述，不把兩者的鍵並列成同一套設定

#### Scenario: 讀取攔截的歸屬

- **WHEN** 要求「不讀取某個檔案的內容」
- **THEN** 以權限層的拒絕規則承接，不宣稱 Codex 的 hook 層能攔截讀取

#### Scenario: 引用外部文件結論前重新核對

- **WHEN** 後續產出要引用平台能力的查核結論
- **THEN** 重新核對官方文件並附上當次的核對日，不沿用舊結果

### Requirement: 平台權限層的能力以核對過的事實陳述

平台權限層的對照已於 2026-11-17 兩側完成（#111 §3 第 6 項，2026-11-16 補列）。描述任一平台的權限層時 MUST 以該次核對的結果為準，MUST NOT 把兩個平台的設定鍵並列成同一套。

來源：#111 §3 第 6 項；proposal §前置查核。

#### Scenario: Codex 的兩套機制互斥

- **WHEN** 描述 Codex 的權限設定
- **THEN** 陳述 permission profile 與舊的 sandbox 設定不可混用，且本 repo 採哪一套尚未決定（Q1）

#### Scenario: Claude 的拒絕規則涵蓋讀取且不等信任

- **WHEN** 描述 Claude 的權限拒絕能力
- **THEN** 陳述其拒絕規則能涵蓋讀取、支援排除樣式，且在任何層級出現即生效而不等待工作區信任

#### Scenario: 版本下限與欄位存在分開陳述

- **WHEN** 要依賴某個平台設定鍵
- **THEN** 一併查出它的版本下限並與本機 runtime 比對，不以「文件有這個欄位」當作本機可用

## 待決問題（本 delta 不自行決定）

**編號說明**：維護者 2026-11-17 已裁定原 Q1（信任指引寫進安裝流程）、原 Q3（裸檔名 `.env`）、原 Q4（workspace 之外的路徑）、原 Q5（已確認的破壞性命令），四題都已落回對應的 requirement 與 `design.md` 的決策。本節因此重新編號且不留空號：**原 Q2 改編為 Q1**，是本 delta 唯一的待決題。`design.md` §Open Questions 另有一題 Q2（權限層什麼時候設定，原 Q6），它只影響後續 change 的排程，不改變本 delta 的任何 requirement。兩題都不阻擋本 change 進入 apply。

- **Q1（原 Q2，2026-11-17 查核後新增）**：本 repo 的 Codex 設定採 permission profile 還是舊的 sandbox 設定。官方文件明寫兩者不可混用，而這個選擇會改變每一位使用 Codex 的開發者的預設行為。**由維護者決定**；在有結論之前，本 delta 只陳述兩者互斥，不假定本 repo 採哪一種。
