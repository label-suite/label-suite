# Screen Inventory

> **這個檔是生成的，不要手改。**由 `design/system/pages/` 與 `design/system/components/` 產生（`design-system-setup` 步驟 6）。
>
> 批次 `b1-shared-account` ｜交付包 commit `b1fd43c` ｜畫面 9 個、元件 32 個

## 畫面 → 元件

| 畫面 | 視圖數 | 本批 | 用到的元件 |
| :--- | ---: | :---: | :--- |
| [`account/forgot-password`](pages/account-forgot-password.md) | 4 | ✓ | [Auth Card](components/auth-card.md) · [Auth Navbar](components/auth-navbar.md) · [Button](components/button.md) · [Input](components/input.md) · [Language Toggle](components/lang-toggle.md) · [State Panel](components/state-panel.md) |
| [`account/login`](pages/account-login.md) | 5 | ✓ | [Alert Banner](components/alert-banner.md) · [Auth Card](components/auth-card.md) · [Auth Navbar](components/auth-navbar.md) · [Button](components/button.md) · [Divider](components/divider.md) · [Input](components/input.md) · [Language Toggle](components/lang-toggle.md) · [Password Eye Toggle](components/password-eye-toggle.md) · [Spinner](components/spinner.md) |
| [`account/profile`](pages/account-profile.md) | 4 | ✓ | [App Shell（Sidebar）](components/app-shell.md) · [Avatar](components/avatar.md) · [Button](components/button.md) · [Input](components/input.md) · [Password Eye Toggle](components/password-eye-toggle.md) · [Skeleton](components/skeleton.md) · [Toast](components/toast.md) · [Toggle Switch](components/toggle-switch.md) |
| [`account/register`](pages/account-register.md) | 5 | ✓ | [Alert Banner](components/alert-banner.md) · [Auth Card](components/auth-card.md) · [Auth Navbar](components/auth-navbar.md) · [Button](components/button.md) · [Input](components/input.md) · [Language Toggle](components/lang-toggle.md) · [Password Eye Toggle](components/password-eye-toggle.md) |
| [`account/reset-password`](pages/account-reset-password.md) | 6 | ✓ | [Auth Card](components/auth-card.md) · [Auth Navbar](components/auth-navbar.md) · [Button](components/button.md) · [Input](components/input.md) · [Language Toggle](components/lang-toggle.md) · [Password Eye Toggle](components/password-eye-toggle.md) · [Proto Toggle Bar](components/proto-toggle-bar.md) · [State Panel](components/state-panel.md) |
| [`account/verify-email`](pages/account-verify-email.md) | 4 | ✓ | [Auth Card](components/auth-card.md) · [Auth Navbar](components/auth-navbar.md) · [Language Toggle](components/lang-toggle.md) · [Proto Toggle Bar](components/proto-toggle-bar.md) · [State Panel](components/state-panel.md) |
| [`components-showcase`](pages/components-showcase.md) | 1 | ✓ | [Accordion](components/accordion.md) · [Alert Banner](components/alert-banner.md) · [Avatar](components/avatar.md) · [Badge](components/badge.md) · [Breadcrumb](components/breadcrumb.md) · [Button](components/button.md) · [Chip](components/chip.md) · [Color Dot](components/color-dot.md) · [Date Range Picker](components/date-range-picker.md) · [Divider](components/divider.md) · [Input](components/input.md) · [Language Toggle](components/lang-toggle.md) · [Metric KPI Tile](components/metric.md) · [Pagination](components/pagination.md) · [Progress Bar](components/progress-bar.md) · [Review Status Track](components/review-status-track.md) · [Skeleton](components/skeleton.md) · [State Panel](components/state-panel.md) · [Status Pill](components/status-pill.md) · [Toast](components/toast.md) · [Toggle Switch](components/toggle-switch.md) |
| [`index`](pages/index.md) | 1 | ✓ | — |
| [`shared/app-shell`](pages/shared-app-shell.md) | 13 | ✓ | [App Shell（Sidebar）](components/app-shell.md) |

合計 **43 個視圖**。

## 元件 → 畫面

| 元件 | b1 用到它的畫面 | 數 |
| :--- | :--- | ---: |
| [Accordion](components/accordion.md) | `components-showcase` | 1 |
| [Alert Banner](components/alert-banner.md) | `account/login` · `account/register` · `components-showcase` | 3 |
| [App Shell（Sidebar）](components/app-shell.md) | `account/profile` · `shared/app-shell` | 2 |
| [Auth Card](components/auth-card.md) | `account/forgot-password` · `account/login` · `account/register` · `account/reset-password` · `account/verify-email` | 5 |
| [Auth Navbar](components/auth-navbar.md) | `account/forgot-password` · `account/login` · `account/register` · `account/reset-password` · `account/verify-email` | 5 |
| [Avatar](components/avatar.md) | `account/profile` · `components-showcase` | 2 |
| [Badge](components/badge.md) | `components-showcase` | 1 |
| [Breadcrumb](components/breadcrumb.md) | `components-showcase` | 1 |
| [Button](components/button.md) | `account/forgot-password` · `account/login` · `account/profile` · `account/register` · `account/reset-password` · `components-showcase` | 6 |
| [Chip](components/chip.md) | `components-showcase` | 1 |
| [Color Dot](components/color-dot.md) | `components-showcase` | 1 |
| [Desktop Content Tabs](components/content-tabs.md) | **（b1 無）** | 0 |
| [Data Table](components/data-table.md) | **（b1 無）** | 0 |
| [Date Range Picker](components/date-range-picker.md) | `components-showcase` | 1 |
| [Divider](components/divider.md) | `account/login` · `components-showcase` | 2 |
| [Empty State](components/empty-state.md) | **（b1 無）** | 0 |
| [Input](components/input.md) | `account/forgot-password` · `account/login` · `account/profile` · `account/register` · `account/reset-password` · `components-showcase` | 6 |
| [Language Toggle](components/lang-toggle.md) | `account/forgot-password` · `account/login` · `account/register` · `account/reset-password` · `account/verify-email` · `components-showcase` | 6 |
| [List Toolbar](components/list-toolbar.md) | **（b1 無）** | 0 |
| [Metric KPI Tile](components/metric.md) | `components-showcase` | 1 |
| [Modal](components/modal.md) | **（b1 無）** | 0 |
| [Pagination](components/pagination.md) | `components-showcase` | 1 |
| [Password Eye Toggle](components/password-eye-toggle.md) | `account/login` · `account/profile` · `account/register` · `account/reset-password` | 4 |
| [Progress Bar](components/progress-bar.md) | `components-showcase` | 1 |
| [Proto Toggle Bar](components/proto-toggle-bar.md) | `account/reset-password` · `account/verify-email` | 2 |
| [Review Status Track](components/review-status-track.md) | `components-showcase` | 1 |
| [Skeleton](components/skeleton.md) | `account/profile` · `components-showcase` | 2 |
| [Spinner](components/spinner.md) | `account/login` | 1 |
| [State Panel](components/state-panel.md) | `account/forgot-password` · `account/reset-password` · `account/verify-email` · `components-showcase` | 4 |
| [Status Pill](components/status-pill.md) | `components-showcase` | 1 |
| [Toast](components/toast.md) | `account/profile` · `components-showcase` | 2 |
| [Toggle Switch](components/toggle-switch.md) | `account/profile` · `components-showcase` | 2 |

32 個元件裡，**27 個**在 b1 的畫面上有使用紀錄，**5 個**目前只有正典定義、使用頁面在 b2–b4。

## 雙向一致性

- `pages/` 提到的元件都在 `components/` 裡：是
- `components/` 的每一份都有「用到它的畫面」一節：是（32／32）
- 交付包 b1 的 9 個條目都有對應的 `pages/` 檔：是
