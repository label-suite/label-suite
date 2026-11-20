# response-localization Specification

## Purpose

讓外層 `message` 依呼叫端的 `Accept-Language` 以 zh-TW 或 en 呈現，定下語言挑選規則、預設語言、全部被拒時的 `406`、回應的 `Content-Language` 標頭，以及逐欄位錯誤說明維持英文的例外，讓前端把 `message` 當成可直接顯示的字串。

## Requirements

### Requirement: 外層訊息依語言偏好挑選語言

系統 SHALL 依 `Accept-Language` 的 q 值由高到低，挑第一個支援的語言（`zh-TW`、`en`）組成外層 `message`；未帶時用 `zh-TW`，`*` 視為接受預設 `zh-TW`，不支援的語言略過，比對不分大小寫，`zh` 與 `zh-Hant` 對到 `zh-TW`。`message` MUST 是該語言的字串，MUST NOT 是訊息 key 或未翻譯的英文。

來源：api-agent-rules A8、`docs/development/architecture.mdx` §i18n 兩層、clarification Q2。

#### Scenario: 回應訊息依語言偏好本地化

- **WHEN** 呼叫端帶 `Accept-Language: en` 送出 `GET /api/v1/health`
- **THEN** 外層 `message` 為 `"Success"`

#### Scenario: 指定 zh-TW 時回中文訊息

- **WHEN** 呼叫端帶 `Accept-Language: zh-TW` 送出 `GET /api/v1/health`
- **THEN** 外層 `message` 為 `"成功"`

#### Scenario: 未帶語言偏好時預設 zh-TW

- **WHEN** 呼叫端未帶 `Accept-Language` 送出 `GET /api/v1/no-such-resource`
- **THEN** 外層 `message` 為 `"找不到指定的資源"`

#### Scenario: 依 q 值排序挑語言

- **WHEN** 呼叫端帶 `Accept-Language: zh-TW;q=0.5, en;q=0.9` 送出 `GET /api/v1/health`
- **THEN** 外層 `message` 為 `"Success"`

#### Scenario: 略過不支援的語言

- **WHEN** 呼叫端帶 `Accept-Language: fr, en;q=0.5` 送出 `GET /api/v1/health`
- **THEN** 外層 `message` 為 `"Success"`

#### Scenario: 星號視為接受預設語言

- **WHEN** 呼叫端帶 `Accept-Language: fr, *;q=0.1` 送出 `GET /api/v1/health`
- **THEN** 外層 `message` 為 `"成功"`

#### Scenario: 中文變體與大小寫對到 zh-TW

- **WHEN** 呼叫端分別帶 `Accept-Language` 為 `zh`、`zh-Hant`、`ZH-tw`、`EN` 送出 `GET /api/v1/health`
- **THEN** 前三者的 `message` 為 `"成功"`，`EN` 的 `message` 為 `"Success"`

#### Scenario: 錯誤外層的訊息同樣本地化

- **WHEN** 呼叫端帶 `Accept-Language: en` 送出 `GET /api/v1/no-such-resource`
- **THEN** 外層 `message` 為 `"The requested resource was not found."`

### Requirement: 語言全部被拒時回 406

系統 SHALL 在 `Accept-Language` 列出的語言全部不支援、或支援的語言與 `*` 都以 `q=0` 拒絕時，回覆 `406` 錯誤外層、`code` 為 `NOT_ACCEPTABLE`，`message` 一律用 `zh-TW`。

來源：api-agent-rules A8、clarification Q2。

#### Scenario: 只接受不支援的語言時回 406

- **WHEN** 呼叫端帶 `Accept-Language: fr` 送出 `GET /api/v1/health`
- **THEN** 系統回覆 `406`，`code` 為 `"NOT_ACCEPTABLE"`、`data` 為 `null`、`message` 為 `"不支援所要求的語言"`

#### Scenario: 所有語言都以 q=0 拒絕時回 406

- **WHEN** 呼叫端帶 `Accept-Language: zh-TW;q=0, en;q=0, *;q=0` 送出 `GET /api/v1/health`
- **THEN** 系統回覆 `406`，`code` 為 `"NOT_ACCEPTABLE"`

### Requirement: 回應標出實際使用的語言

系統 SHALL 在每個帶外層 `message` 的回應加上 `Content-Language` 標頭，值為 `message` 實際使用的語言（`zh-TW` 或 `en`）。

來源：api-agent-rules A8、clarification Q2（api-contract N10）。

#### Scenario: 成功與錯誤回應都帶 Content-Language

- **WHEN** 呼叫端帶 `Accept-Language: en` 分別送出 `GET /api/v1/health` 與 `GET /api/v1/no-such-resource`
- **THEN** 兩個回應的 `Content-Language` 都是 `en`

#### Scenario: 406 回應的 Content-Language 為 zh-TW

- **WHEN** 呼叫端帶 `Accept-Language: fr` 送出 `GET /api/v1/health`
- **THEN** `406` 回應的 `Content-Language` 為 `zh-TW`

### Requirement: 逐欄位錯誤說明維持英文

系統 SHALL 讓 `422` 回應 `errors` 每一筆的 `message` 維持英文、不隨 `Accept-Language` 改變，這是 A8 的明文例外；外層 `message` 仍依語言偏好本地化。

來源：api-agent-rules A8、clarification Q2。

#### Scenario: 逐欄位錯誤說明不隨語言改變

- **WHEN** 呼叫端帶 `Accept-Language: zh-TW` 對要求 `displayName` 的端點送出 `{}`
- **THEN** 外層 `message` 為 `"輸入資料有誤，請檢查標示的欄位"`
- **AND** `errors` 中 `field` 為 `"displayName"` 那一筆的 `message` 為英文 `"Field required"`

### Requirement: 語言偏好只作用在 /api/v1

系統 SHALL 只對 `/api/v1` 底下的路徑套用語言挑選與 `406` 規則；`/api/v1` 以外的路徑 MUST NOT 因 `Accept-Language` 回覆 `406`。

來源：api-agent-rules A8、api-contract §請求與回應標頭。

#### Scenario: /api/v1 以外的路徑不因語言回 406

- **WHEN** 呼叫端帶 `Accept-Language: fr` 送出 `GET /openapi.json`
- **THEN** 回應不是 `406`
