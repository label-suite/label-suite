# Screen Inventory

> **這個檔是生成的，不要手改。**由 `design/system/pages/` 與 `design/system/components/` 產生（`design-system-setup` 步驟 6）。
>
> 最近一批 `b4-dataset-sweep` ｜交付包 commit `b16b294`（b4 重驗，#608） ｜畫面 19 個、元件 35 個

## 畫面 → 元件

| 畫面 | 批次 | 視圖數 | 本批 | 用到的元件 |
| :--- | :--- | ---: | :---: | :--- |
| [`account/forgot-password`](pages/account-forgot-password.md) | b1 | 4 |  | [Auth Card](components/auth-card.md) · [Auth Navbar](components/auth-navbar.md) · [Button](components/button.md) · [Input](components/input.md) · [Language Toggle](components/lang-toggle.md) · [State Panel](components/state-panel.md) |
| [`account/login`](pages/account-login.md) | b1 | 5 |  | [Alert Banner](components/alert-banner.md) · [Auth Card](components/auth-card.md) · [Auth Navbar](components/auth-navbar.md) · [Button](components/button.md) · [Divider](components/divider.md) · [Input](components/input.md) · [Language Toggle](components/lang-toggle.md) · [Password Eye Toggle](components/password-eye-toggle.md) · [Spinner](components/spinner.md) |
| [`account/profile`](pages/account-profile.md) | b1 | 4 |  | [App Shell（Sidebar）](components/app-shell.md) · [Avatar](components/avatar.md) · [Button](components/button.md) · [Input](components/input.md) · [Password Eye Toggle](components/password-eye-toggle.md) · [Skeleton](components/skeleton.md) · [Toast](components/toast.md) · [Toggle Switch](components/toggle-switch.md) |
| [`account/register`](pages/account-register.md) | b1 | 5 |  | [Alert Banner](components/alert-banner.md) · [Auth Card](components/auth-card.md) · [Auth Navbar](components/auth-navbar.md) · [Button](components/button.md) · [Input](components/input.md) · [Language Toggle](components/lang-toggle.md) · [Password Eye Toggle](components/password-eye-toggle.md) |
| [`account/reset-password`](pages/account-reset-password.md) | b1 | 6 |  | [Auth Card](components/auth-card.md) · [Auth Navbar](components/auth-navbar.md) · [Button](components/button.md) · [Input](components/input.md) · [Language Toggle](components/lang-toggle.md) · [Password Eye Toggle](components/password-eye-toggle.md) · [Proto Toggle Bar](components/proto-toggle-bar.md) · [State Panel](components/state-panel.md) |
| [`account/verify-email`](pages/account-verify-email.md) | b1 | 4 |  | [Auth Card](components/auth-card.md) · [Auth Navbar](components/auth-navbar.md) · [Language Toggle](components/lang-toggle.md) · [Proto Toggle Bar](components/proto-toggle-bar.md) · [State Panel](components/state-panel.md) |
| [`admin/role-settings`](pages/admin-role-settings.md) | b2 | 4 |  | [Alert Banner](components/alert-banner.md) · [App Shell（Sidebar）](components/app-shell.md) · [Badge](components/badge.md) · [Button](components/button.md) · [Data Table](components/data-table.md) · [Desktop Content Tabs](components/content-tabs.md) · [Empty State](components/empty-state.md) · [Modal](components/modal.md) · [Toast](components/toast.md) |
| [`admin/user-management`](pages/admin-user-management.md) | b2 | 4 |  | [Alert Banner](components/alert-banner.md) · [App Shell（Sidebar）](components/app-shell.md) · [Badge](components/badge.md) · [Button](components/button.md) · [Data Table](components/data-table.md) · [Desktop Content Tabs](components/content-tabs.md) · [Empty State](components/empty-state.md) · [Input](components/input.md) · [List Toolbar](components/list-toolbar.md) · [Modal](components/modal.md) · [Pagination](components/pagination.md) · [Toast](components/toast.md) |
| [`annotation/annotation-list`](pages/annotation-annotation-list.md) | b3 | 9 |  | [App Shell（Sidebar）](components/app-shell.md) · [Badge](components/badge.md) · [Breadcrumb](components/breadcrumb.md) · [Button](components/button.md) · [Data Table](components/data-table.md) · [Empty State](components/empty-state.md) · [List Toolbar](components/list-toolbar.md) · [Pagination](components/pagination.md) · [Progress Bar](components/progress-bar.md) · [Status Pill](components/status-pill.md) |
| [`annotation/annotation-workspace`](pages/annotation-annotation-workspace.md) | b3 | 13 |  | [App Shell（Sidebar）](components/app-shell.md) · [Breadcrumb](components/breadcrumb.md) · [Button](components/button.md) · [Card](components/card.md) · [Desktop Content Tabs](components/content-tabs.md) · [Empty State](components/empty-state.md) · [Input](components/input.md) · [Modal](components/modal.md) · [Progress Bar](components/progress-bar.md) · [Review Status Track](components/review-status-track.md) · [Toast](components/toast.md) · [Tooltip](components/tooltip.md) |
| [`components-showcase`](pages/components-showcase.md) | b1 | 1 |  | [Accordion](components/accordion.md) · [Alert Banner](components/alert-banner.md) · [Avatar](components/avatar.md) · [Badge](components/badge.md) · [Breadcrumb](components/breadcrumb.md) · [Button](components/button.md) · [Chip](components/chip.md) · [Color Dot](components/color-dot.md) · [Date Range Picker](components/date-range-picker.md) · [Divider](components/divider.md) · [Input](components/input.md) · [Language Toggle](components/lang-toggle.md) · [Metric KPI Tile](components/metric.md) · [Pagination](components/pagination.md) · [Progress Bar](components/progress-bar.md) · [Review Status Track](components/review-status-track.md) · [Skeleton](components/skeleton.md) · [State Panel](components/state-panel.md) · [Status Pill](components/status-pill.md) · [Toast](components/toast.md) · [Toggle Switch](components/toggle-switch.md) |
| [`dashboard/dashboard`](pages/dashboard-dashboard.md) | b2 | 8 |  | [App Shell（Sidebar）](components/app-shell.md) · [Badge](components/badge.md) · [Button](components/button.md) · [Card](components/card.md) · [Empty State](components/empty-state.md) · [Metric KPI Tile](components/metric.md) · [Progress Bar](components/progress-bar.md) · [Skeleton](components/skeleton.md) |
| [`dataset/dataset-analysis-detail`](pages/dataset-dataset-analysis-detail.md) | b4 | 27 | ✓ | [Accordion](components/accordion.md) · [App Shell（Sidebar）](components/app-shell.md) · [Badge](components/badge.md) · [Breadcrumb](components/breadcrumb.md) · [Button](components/button.md) · [Card](components/card.md) · [Chip](components/chip.md) · [Color Dot](components/color-dot.md) · [Data Table](components/data-table.md) · [Desktop Content Tabs](components/content-tabs.md) · [Divider](components/divider.md) · [Empty State](components/empty-state.md) · [Metric KPI Tile](components/metric.md) · [Progress Bar](components/progress-bar.md) |
| [`dataset/dataset-analysis-list`](pages/dataset-dataset-analysis-list.md) | b4 | 5 | ✓ | [App Shell（Sidebar）](components/app-shell.md) · [Badge](components/badge.md) · [Data Table](components/data-table.md) · [Empty State](components/empty-state.md) · [List Toolbar](components/list-toolbar.md) · [Pagination](components/pagination.md) · [Progress Bar](components/progress-bar.md) · [Toast](components/toast.md) |
| [`index`](pages/index.md) | b1 | 1 |  | — |
| [`shared/app-shell`](pages/shared-app-shell.md) | b1 | 13 |  | [App Shell（Sidebar）](components/app-shell.md) |
| [`task-management/task-detail`](pages/task-management-task-detail.md) | b2 | 17 |  | [Accordion](components/accordion.md) · [App Shell（Sidebar）](components/app-shell.md) · [Badge](components/badge.md) · [Breadcrumb](components/breadcrumb.md) · [Button](components/button.md) · [Card](components/card.md) · [Chip](components/chip.md) · [Color Dot](components/color-dot.md) · [Data Table](components/data-table.md) · [Date Range Picker](components/date-range-picker.md) · [Desktop Content Tabs](components/content-tabs.md) · [Empty State](components/empty-state.md) · [Metric KPI Tile](components/metric.md) · [Modal](components/modal.md) · [Pagination](components/pagination.md) · [Skeleton](components/skeleton.md) · [Toast](components/toast.md) · [Toggle Switch](components/toggle-switch.md) · [Tooltip](components/tooltip.md) |
| [`task-management/task-list`](pages/task-management-task-list.md) | b2 | 7 |  | [App Shell（Sidebar）](components/app-shell.md) · [Badge](components/badge.md) · [Button](components/button.md) · [Data Table](components/data-table.md) · [Empty State](components/empty-state.md) · [List Toolbar](components/list-toolbar.md) · [Modal](components/modal.md) · [Pagination](components/pagination.md) · [Toast](components/toast.md) |
| [`task-management/task-new`](pages/task-management-task-new.md) | b2 | 5 |  | [Accordion](components/accordion.md) · [App Shell（Sidebar）](components/app-shell.md) · [Button](components/button.md) · [Card](components/card.md) · [Chip](components/chip.md) · [Color Dot](components/color-dot.md) · [Empty State](components/empty-state.md) · [Input](components/input.md) · [Modal](components/modal.md) · [Step Indicator](components/step-indicator.md) · [Toast](components/toast.md) · [Toggle Switch](components/toggle-switch.md) · [Tooltip](components/tooltip.md) |

合計 **140 個視圖**。

## 元件 → 畫面

由 `pages/` 的「視圖與元件」一節反推。

| 元件 | b1 用到它的畫面 | b2 用到它的畫面 | b3 用到它的畫面 | b4 用到它的畫面 | 數 | 程式實作 |
| :--- | :--- | :--- | :--- | :--- | ---: | :--- |
| [Accordion](components/accordion.md) | `components-showcase` | `task-management/task-detail` · `task-management/task-new` | **（b3 無）** | `dataset/dataset-analysis-detail` | 4 | 尚未實作 |
| [Alert Banner](components/alert-banner.md) | `account/login` · `account/register` · `components-showcase` | `admin/role-settings` · `admin/user-management` | **（b3 無）** | **（b4 無）** | 5 | `frontend/src/components/ui/alert.tsx` |
| [App Shell（Sidebar）](components/app-shell.md) | `account/profile` · `shared/app-shell` | `admin/role-settings` · `admin/user-management` · `dashboard/dashboard` · `task-management/task-detail` · `task-management/task-list` · `task-management/task-new` | `annotation/annotation-list` · `annotation/annotation-workspace` | `dataset/dataset-analysis-detail` · `dataset/dataset-analysis-list` | 12 | 尚未實作 |
| [Auth Card](components/auth-card.md) | `account/forgot-password` · `account/login` · `account/register` · `account/reset-password` · `account/verify-email` | **（b2 無）** | **（b3 無）** | **（b4 無）** | 5 | `frontend/src/features/auth/auth-card.tsx` |
| [Auth Navbar](components/auth-navbar.md) | `account/forgot-password` · `account/login` · `account/register` · `account/reset-password` · `account/verify-email` | **（b2 無）** | **（b3 無）** | **（b4 無）** | 5 | `frontend/src/features/auth/auth-layout.tsx` |
| [Avatar](components/avatar.md) | `account/profile` · `components-showcase` | **（b2 無）** | **（b3 無）** | **（b4 無）** | 2 | 尚未實作 |
| [Badge](components/badge.md) | `components-showcase` | `admin/role-settings` · `admin/user-management` · `dashboard/dashboard` · `task-management/task-detail` · `task-management/task-list` | `annotation/annotation-list` | `dataset/dataset-analysis-detail` · `dataset/dataset-analysis-list` | 9 | `frontend/src/components/ui/badge.tsx` |
| [Breadcrumb](components/breadcrumb.md) | `components-showcase` | `task-management/task-detail` | `annotation/annotation-list` · `annotation/annotation-workspace` | `dataset/dataset-analysis-detail` | 5 | 尚未實作 |
| [Button](components/button.md) | `account/forgot-password` · `account/login` · `account/profile` · `account/register` · `account/reset-password` · `components-showcase` | `admin/role-settings` · `admin/user-management` · `dashboard/dashboard` · `task-management/task-detail` · `task-management/task-list` · `task-management/task-new` | `annotation/annotation-list` · `annotation/annotation-workspace` | `dataset/dataset-analysis-detail` | 15 | `frontend/src/components/ui/button.tsx` |
| [Card](components/card.md) | **（b1 無）** | `dashboard/dashboard` · `task-management/task-detail` · `task-management/task-new` | `annotation/annotation-workspace` | `dataset/dataset-analysis-detail` | 5 | `frontend/src/components/ui/card.tsx` |
| [Chip](components/chip.md) | `components-showcase` | `task-management/task-detail` · `task-management/task-new` | **（b3 無）** | `dataset/dataset-analysis-detail` | 4 | 尚未實作 |
| [Color Dot](components/color-dot.md) | `components-showcase` | `task-management/task-detail` · `task-management/task-new` | **（b3 無）** | `dataset/dataset-analysis-detail` | 4 | 尚未實作 |
| [Data Table](components/data-table.md) | **（b1 無）** | `admin/role-settings` · `admin/user-management` · `task-management/task-detail` · `task-management/task-list` | `annotation/annotation-list` | `dataset/dataset-analysis-detail` · `dataset/dataset-analysis-list` | 7 | 尚未實作 |
| [Date Range Picker](components/date-range-picker.md) | `components-showcase` | `task-management/task-detail` | **（b3 無）** | **（b4 無）** | 2 | 尚未實作 |
| [Desktop Content Tabs](components/content-tabs.md) | **（b1 無）** | `admin/role-settings` · `admin/user-management` · `task-management/task-detail` | `annotation/annotation-workspace` | `dataset/dataset-analysis-detail` | 5 | 尚未實作 |
| [Divider](components/divider.md) | `account/login` · `components-showcase` | **（b2 無）** | **（b3 無）** | `dataset/dataset-analysis-detail` | 3 | `frontend/src/components/ui/separator.tsx` |
| [Empty State](components/empty-state.md) | **（b1 無）** | `admin/role-settings` · `admin/user-management` · `dashboard/dashboard` · `task-management/task-detail` · `task-management/task-list` · `task-management/task-new` | `annotation/annotation-list` · `annotation/annotation-workspace` | `dataset/dataset-analysis-detail` · `dataset/dataset-analysis-list` | 10 | `frontend/src/components/ui/empty.tsx` |
| [Input](components/input.md) | `account/forgot-password` · `account/login` · `account/profile` · `account/register` · `account/reset-password` · `components-showcase` | `admin/user-management` · `task-management/task-new` | `annotation/annotation-workspace` | **（b4 無）** | 9 | `frontend/src/components/ui/input.tsx` |
| [Language Toggle](components/lang-toggle.md) | `account/forgot-password` · `account/login` · `account/register` · `account/reset-password` · `account/verify-email` · `components-showcase` | **（b2 無）** | **（b3 無）** | **（b4 無）** | 6 | `frontend/src/features/auth/language-toggle.tsx` |
| [List Toolbar](components/list-toolbar.md) | **（b1 無）** | `admin/user-management` · `task-management/task-list` | `annotation/annotation-list` | `dataset/dataset-analysis-list` | 4 | 尚未實作 |
| [Metric KPI Tile](components/metric.md) | `components-showcase` | `dashboard/dashboard` · `task-management/task-detail` | **（b3 無）** | `dataset/dataset-analysis-detail` | 4 | 尚未實作 |
| [Modal](components/modal.md) | **（b1 無）** | `admin/role-settings` · `admin/user-management` · `task-management/task-detail` · `task-management/task-list` · `task-management/task-new` | `annotation/annotation-workspace` | **（b4 無）** | 6 | 尚未實作 |
| [Pagination](components/pagination.md) | `components-showcase` | `admin/user-management` · `task-management/task-detail` · `task-management/task-list` | `annotation/annotation-list` | `dataset/dataset-analysis-list` | 6 | 尚未實作 |
| [Password Eye Toggle](components/password-eye-toggle.md) | `account/login` · `account/profile` · `account/register` · `account/reset-password` | **（b2 無）** | **（b3 無）** | **（b4 無）** | 4 | `frontend/src/features/auth/password-input.tsx` |
| [Progress Bar](components/progress-bar.md) | `components-showcase` | `dashboard/dashboard` | `annotation/annotation-list` · `annotation/annotation-workspace` | `dataset/dataset-analysis-detail` · `dataset/dataset-analysis-list` | 6 | 尚未實作 |
| [Proto Toggle Bar](components/proto-toggle-bar.md) | `account/reset-password` · `account/verify-email` | **（b2 無）** | **（b3 無）** | **（b4 無）** | 2 | 尚未實作 |
| [Review Status Track](components/review-status-track.md) | `components-showcase` | **（b2 無）** | `annotation/annotation-workspace` | **（b4 無）** | 2 | 尚未實作 |
| [Skeleton](components/skeleton.md) | `account/profile` · `components-showcase` | `dashboard/dashboard` · `task-management/task-detail` | **（b3 無）** | **（b4 無）** | 4 | `frontend/src/components/ui/skeleton.tsx` |
| [Spinner](components/spinner.md) | `account/login` | **（b2 無）** | **（b3 無）** | **（b4 無）** | 1 | `frontend/src/components/ui/button.tsx`（`loading`） |
| [State Panel](components/state-panel.md) | `account/forgot-password` · `account/reset-password` · `account/verify-email` · `components-showcase` | **（b2 無）** | **（b3 無）** | **（b4 無）** | 4 | 尚未實作 |
| [Status Pill](components/status-pill.md) | `components-showcase` | **（b2 無）** | `annotation/annotation-list` | **（b4 無）** | 2 | 尚未實作 |
| [Step Indicator](components/step-indicator.md) | **（b1 無）** | `task-management/task-new` | **（b3 無）** | **（b4 無）** | 1 | 尚未實作 |
| [Toast](components/toast.md) | `account/profile` · `components-showcase` | `admin/role-settings` · `admin/user-management` · `task-management/task-detail` · `task-management/task-list` · `task-management/task-new` | `annotation/annotation-workspace` | `dataset/dataset-analysis-list` | 9 | 尚未實作 |
| [Toggle Switch](components/toggle-switch.md) | `account/profile` · `components-showcase` | `task-management/task-detail` · `task-management/task-new` | **（b3 無）** | **（b4 無）** | 4 | 尚未實作 |
| [Tooltip](components/tooltip.md) | **（b1 無）** | `task-management/task-detail` · `task-management/task-new` | `annotation/annotation-workspace` | **（b4 無）** | 3 | 尚未實作 |

35 個元件裡，**35 個**在已完成批次的畫面上有使用紀錄，**0 個**沒有。

## 雙向一致性

- `pages/` 提到的元件都在 `components/` 裡：是
- `components/` 的每一份都有「用到它的畫面」一節：是（35／35）
- `components/` 的每一份標頭都有「程式實作」一行：是（35／35）
- 本批（b4）畫面檔連到的元件，元件檔都列了該畫面，反之亦然：是
- 交付包 b1 的 9 個條目都有對應的 `pages/` 檔：是
- 交付包 b1 的每個視圖都出現在畫面檔裡：是
- 交付包 b2 的 6 個條目都有對應的 `pages/` 檔：是
- 交付包 b2 的每個視圖都出現在畫面檔裡：是
- 交付包 b3 的 2 個條目都有對應的 `pages/` 檔：是
- 交付包 b3 的每個視圖都出現在畫面檔裡：是
- 交付包 b4 的 2 個條目都有對應的 `pages/` 檔：是
- 交付包 b4 的每個視圖都出現在畫面檔裡：是
