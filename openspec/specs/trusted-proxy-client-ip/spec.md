# trusted-proxy-client-ip Specification

## Purpose

定義後端如何只信任 Nginx 轉發的來源位址：經 Nginx 的請求要取得原始來源 IP，直連後端、自帶 `X-Forwarded-For` 的請求不得被採信，以及信任範圍怎麼表達與驗證，讓登入嘗試限制等以來源 IP 為鍵的功能不會讓所有人共用同一份額度。

## Requirements

### Requirement: 經 Nginx 的請求取得原始來源位址

後端 SHALL 在請求由受信任的反向代理轉發時，把請求的來源位址還原成代理所報告的原始用戶端位址，且在任何中介層與路由讀取來源位址之前就已還原。兩層編排下的受信任代理只有前端服務（Nginx），Nginx MUST 以附加方式在 `X-Forwarded-For` 的最右側加上它看到的對端位址，不得覆寫用戶端已帶的值。經 Nginx 時能斷言的只有「回報的位址不是 Nginx 的位址、也不是用戶端自帶的偽造值」，不得斷言它等於某個固定值（發布埠的來源位址依平台而異）。

來源：issue #566 驗收條件 1；ADR-004 D7；ADR-008 D1；`architecture.mdx` §部署與維運；clarification Q1、Q3、Q7。

#### Scenario: 經 Nginx 的請求取得原始來源位址

- **WHEN** 以只給 CI 的覆寫檔在 Lite 編排的後端換上回報來源位址的探針，從主機經 `http://localhost:${FRONTEND_PORT}` 對探針路由發出一般請求
- **THEN** 探針回報的來源位址不是 `frontend` 服務的固定位址
- **AND** 回報的位址是合法的 IP 位址，不是空值

#### Scenario: 經 Nginx 帶偽造標頭的請求不採信偽造值

- **WHEN** 同一個編排下，經 Nginx 對探針路由發出帶 `X-Forwarded-For: 6.6.6.6` 的請求
- **THEN** 探針回報的來源位址既不是 `6.6.6.6`，也不是 `frontend` 服務的固定位址

#### Scenario: 受信任的對端帶轉發標頭時採用原始位址

- **WHEN** 以真實的 uvicorn 子行程啟動後端，信任清單只含 `127.0.0.1`，測試用戶端從 loopback 對探針路由發出帶 `X-Forwarded-For: 5.5.5.5` 的請求
- **THEN** 探針回報的來源位址是 `5.5.5.5`

#### Scenario: 對端不在信任清單時整個標頭不看

- **WHEN** 以真實的 uvicorn 子行程啟動後端，信任清單只含 `192.0.2.1`（不含 loopback），測試用戶端從 loopback 發出帶 `X-Forwarded-For: 5.5.5.5` 的請求
- **THEN** 探針回報的來源位址是 `127.0.0.1`，不是 `5.5.5.5`

#### Scenario: Nginx 以附加方式轉發 X-Forwarded-For

- **WHEN** 讀取 `frontend/nginx.conf` 的 `/api/v1/` 轉發設定
- **THEN** 設定含 `X-Forwarded-For $proxy_add_x_forwarded_for`，不是 `$remote_addr` 或固定值

### Requirement: 直接連到後端自帶偽造標頭的請求不被採信

後端 SHALL 只在對端位址位於信任清單內時才採信 `X-Forwarded-For` 與 `X-Forwarded-Proto`；對端不在清單內時兩個標頭 MUST 被整個忽略，來源位址維持對端位址、協定維持 `http`。信任清單同時管這兩個標頭，沒有分開的開關。

來源：issue #566 驗收條件 2；ADR-004 D7；`architecture.mdx` §部署與維運；clarification Q1、Q5；`system-design.md` 實測 B、C3。

#### Scenario: 直接連後端自帶偽造標頭不被採信

- **WHEN** 以真實的 uvicorn 子行程啟動後端，信任清單只含 `192.0.2.1`，對探針路由發出帶 `X-Forwarded-For: 6.6.6.6` 與 `X-Forwarded-Proto: https` 的請求
- **THEN** 探針回報的來源位址是請求的對端位址（`127.0.0.1`），不是 `6.6.6.6`
- **AND** 回報的協定是 `http`，不是 `https`

#### Scenario: 受信任的對端帶 X-Forwarded-Proto 時採用其值

- **WHEN** 以真實的 uvicorn 子行程啟動後端，信任清單只含 `127.0.0.1`，從 loopback 對探針路由發出帶 `X-Forwarded-Proto: https` 的請求
- **THEN** 探針回報的協定是 `https`

#### Scenario: 經 Nginx 時回報的協定恆為 http

- **WHEN** 同 Lite 編排的探針環境，經 Nginx 發出帶 `X-Forwarded-Proto: https` 的請求
- **THEN** 探針回報的協定是 `http`，因為 Nginx 以自己的 `$scheme` 覆寫用戶端帶的值

### Requirement: 多段轉發鏈取右到左第一個不受信任的位址

後端 SHALL 對 `X-Forwarded-For` 由右往左逐項檢查，取第一個不在信任清單內的位址作為來源位址；多行 `X-Forwarded-For` 標頭 MUST 以逗號串接後依同一規則處理。用戶端自行放在鏈左側的值 MUST NOT 影響結果。

來源：issue #566 驗收條件 2；ADR-004 D7；clarification Q1、Q2、Q3；`system-design.md` 實測 C1、C2、E6。

#### Scenario: 多層鏈取右到左第一個不受信任的位址

- **WHEN** 以真實的 uvicorn 子行程啟動後端，信任清單只含 `127.0.0.1`，從 loopback 發出 `X-Forwarded-For: 6.6.6.6, 5.5.5.5, 127.0.0.1` 的請求
- **THEN** 探針回報的來源位址是 `5.5.5.5`，不是最左側的 `6.6.6.6`

#### Scenario: 兩行 X-Forwarded-For 依同一規則處理

- **WHEN** 同一個請求送兩行 `X-Forwarded-For`（`6.6.6.6` 與 `7.7.7.7`），信任清單只含 `127.0.0.1`
- **THEN** 探針回報的來源位址是 `7.7.7.7`

#### Scenario: 用戶端自帶的鏈不影響經 Nginx 的結果

- **WHEN** 在 Lite 編排的探針環境，經 Nginx 發出 `X-Forwarded-For: 9.9.9.9, 8.8.8.8` 的請求
- **THEN** 探針回報的來源位址不是 `9.9.9.9`、不是 `8.8.8.8`，也不是 `frontend` 服務的固定位址

### Requirement: 沒有反向代理時只信任 loopback

未設定 `FORWARDED_ALLOW_IPS` 時，後端 SHALL 只信任 `127.0.0.1` 與 `::1`；本機開發與單獨執行後端映像（沒有 Nginx、沒有編排檔）時，來自其他位址的偽造標頭 MUST NOT 被採信。映像的啟動指令 MUST NOT 以旗標指定信任清單，否則編排檔傳入的環境變數會被靜默蓋掉。

來源：issue #566；clarification Q1、Q10；`system-design.md` 實測 A1、B、D2。

#### Scenario: 預設信任清單只有 loopback

- **WHEN** 不設定 `FORWARDED_ALLOW_IPS`，載入後端設定
- **THEN** 信任清單恰為 `127.0.0.1` 與 `::1`

#### Scenario: 映像的啟動指令不帶信任清單旗標

- **WHEN** 讀取 `backend/Dockerfile` 的 `CMD`
- **THEN** 指令不含 `--forwarded-allow-ips`、`--proxy-headers`、`--no-proxy-headers`

#### Scenario: 環境變數指定的信任清單在映像啟動時生效

- **WHEN** 以不帶任何代理旗標的 uvicorn 子行程啟動後端（與映像的啟動指令相同形式）並設定 `FORWARDED_ALLOW_IPS=192.0.2.1`，從 loopback 發出帶 `X-Forwarded-For: 5.5.5.5` 的請求
- **THEN** 探針回報的來源位址是 `127.0.0.1`、不是 `5.5.5.5`；預設清單（含 loopback）下同一請求會回報 `5.5.5.5`，所以這個結果證明環境變數指定的清單取代了預設而生效
