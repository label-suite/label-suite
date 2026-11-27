# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: 暫時落點顯示目前登入者並提供登出`
- TO: `### Requirement: 暫時落點顯示目前登入者`

## MODIFIED Requirements

### Requirement: 暫時落點顯示目前登入者

`/dashboard/dashboard` SHALL 只給已登入的人，畫在登入後外殼裡（有側欄，不再沿用登入頁的頁首），卡片依序顯示「你已登入」、「{名稱}（{Email}）」、系統角色（`user` 顯示「平台成員」、`super_admin` 顯示「系統管理員」）與「儀表板還在建置中，完成後登入會直接帶你過去。」；卡片 MUST NOT 有登出鈕，登出由側欄提供。卡片 MUST NOT 顯示任何業務資料或任務角色。被側欄擋下帶回這一頁時，擋下說明顯示在卡片之上。

來源：Issue #719 決定表 sa-5／7 與落點確認（2026-11-26）；規格 01-01 §已確認決議 Q7；規格 01-05 §從這一台登出；PRD §使用者角色 §角色清單；規格 07-01 §導覽項目與可見性 第 1 條、§進入模組的條件 第 3 條；clarification Q2、Q4。

#### Scenario: 平台成員看到自己的身分

- **WHEN** 平台成員「王小明」（`user@example.com`）登入後到達 `/dashboard/dashboard`
- **THEN** 卡片標題為「你已登入」，身分列為「王小明（user@example.com）」，角色顯示「平台成員」
- **AND** 卡片有說明「儀表板還在建置中，完成後登入會直接帶你過去。」，卡片裡沒有「登出」鈕
- **AND** 頁面有側欄，側欄有登出控制項

#### Scenario: 系統管理員看到系統管理員

- **WHEN** 系統角色為 `super_admin` 的使用者到達 `/dashboard/dashboard`
- **THEN** 角色顯示「系統管理員」

#### Scenario: 落點的瀏覽器標題

- **WHEN** 介面語言為繁體中文，到達 `/dashboard/dashboard`
- **THEN** 瀏覽器標題為「Label Suite — 你已登入」
