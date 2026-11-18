# 規格章節索引

交付包版本：commit `5b1cb921515b`，prototype tree `d9c2ab67868b`。

由 `manifest.json` 反轉而成：規格頁 → 指向它的視圖。「規格有、畫面沒有」一眼看得出來——沒有出現在下表的規格頁，就是沒有任何視圖指向它。

## `docs/specs/01-account/01-login.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#卡控機制` | `account/login#state-field-error` |
| `#已確認決議` | `account/forgot-password#sim-logged-in` |
| `#已確認決議` | `account/login#sim-logged-in` |
| `#已確認決議` | `account/login#sim-logged-out` |
| `#已確認決議` | `account/register#sim-logged-in` |
| `#已確認決議` | `account/register#sim-logged-out` |
| `#規格` | `account/login#state-default` |
| `#規格` | `account/login#state-submitting` |

## `docs/specs/01-account/02-register.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#卡控機制` | `account/register#state-field-error` |
| `#卡控機制` | `account/verify-email#proto-expired` |
| `#卡控機制` | `account/verify-email#proto-used` |
| `#規格` | `account/register#state-default` |
| `#規格` | `account/register#state-submitted` |
| `#規格` | `account/verify-email#proto-valid` |
| `#規格` | `account/verify-email#sim-hold` |

## `docs/specs/01-account/03-reset-password.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#卡控機制` | `account/forgot-password#state-submitted` |
| `#卡控機制` | `account/reset-password#state-mismatch` |
| `#已確認決議` | `account/reset-password#proto-expired` |
| `#已確認決議` | `account/reset-password#proto-used` |
| `#規格` | `account/forgot-password#sim-logged-out` |
| `#規格` | `account/forgot-password#state-default` |
| `#規格` | `account/reset-password#proto-valid` |
| `#規格` | `account/reset-password#sim-logged-out` |
| `#規格` | `account/reset-password#state-success` |

## `docs/specs/01-account/04-profile.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#規格` | `account/profile#state-default` |
| `#規格` | `account/profile#toast-saved` |
| `#連結-google-帳號` | `account/profile#state-google-linked` |
| `#頭像` | `account/profile#state-avatar-preview` |

## `docs/specs/01-account/05-login-state.mdx`

沒有視圖指向它。原因：PRD §Site Map「不是獨立頁面」。

## `docs/specs/02-dashboard/01-dashboard.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#已確認決議` | `dashboard/dashboard#param-scenario-user` |
| `#規格` | `dashboard/dashboard#param-scenario-annotator` |
| `#規格` | `dashboard/dashboard#param-scenario-project-leader` |
| `#規格` | `dashboard/dashboard#param-scenario-reviewer` |
| `#規格` | `dashboard/dashboard#param-scenario-super-admin-data` |
| `#規格` | `dashboard/dashboard#state-default` |
| `#邊界情況edge-case` | `dashboard/dashboard#param-view-error` |
| `#邊界情況edge-case` | `dashboard/dashboard#param-view-skeleton` |

## `docs/specs/03-task-management/01-task-list.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#規格` | `task-management/task-list#state-default` |
| `#誰看得到哪些任務` | `task-management/task-list#role-task-role` |
| `#邊界情況edge-case` | `task-management/task-list#param-view-empty` |
| `#邊界情況edge-case` | `task-management/task-list#param-view-error` |
| `#邊界情況edge-case` | `task-management/task-list#sim-delete-error` |
| `#邊界情況edge-case` | `task-management/task-list#state-filtered-empty` |

## `docs/specs/03-task-management/02-task-new.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#標記說明` | `task-management/task-new#state-step4` |
| `#規格` | `task-management/task-new#modal-dataset-preview` |
| `#規格` | `task-management/task-new#state-step1` |
| `#規格` | `task-management/task-new#state-step2` |
| `#規格` | `task-management/task-new#state-step3` |
| `#邊界情況edge-case` | `task-management/task-new#modal-leave-confirm` |
| `#階層標籤的編輯與選取` | `task-management/task-new#modal-taxonomy-delete` |

## `docs/specs/03-task-management/03-task-detail.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#任務的五個狀態與轉換` | `task-management/task-detail#param-status` |
| `#基本資料` | `task-management/task-detail#param-section-basic` |
| `#審核設定` | `task-management/task-detail#param-section-review` |
| `#工時紀錄` | `task-management/task-detail#tab-work-log` |
| `#成員管理` | `task-management/task-detail#tab-member-management` |
| `#抽樣設定` | `task-management/task-detail#param-section-sampling` |
| `#概覽` | `task-management/task-detail#tab-overview` |
| `#標記結果` | `task-management/task-detail#tab-annotation-results` |
| `#標記設定` | `task-management/task-detail#param-section-labeling` |
| `#標記說明` | `task-management/task-detail#param-section-guideline` |
| `#標記進度` | `task-management/task-detail#tab-annotation-progress` |
| `#設定分頁的區塊導覽與編輯` | `task-management/task-detail#tab-settings` |
| `#誰進得來誰看得到哪些分頁` | `task-management/task-detail#role-annotator` |
| `#誰進得來誰看得到哪些分頁` | `task-management/task-detail#role-project-leader` |
| `#誰進得來誰看得到哪些分頁` | `task-management/task-detail#role-reviewer` |
| `#載入中空的與載入失敗` | `task-management/task-detail#state-loading` |
| `#載入中空的與載入失敗` | `task-management/task-detail#state-panel-load-failed` |
| `#載入中空的與載入失敗` | `task-management/task-detail#state-task-not-found` |

## `docs/specs/04-annotation/01-annotation-list.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#審核員的處理狀況與逐列統計` | `annotation/annotation-list#role-reviewer` |
| `#空的與找不到` | `annotation/annotation-list#param-notice-no-actionable-review` |
| `#空的與找不到` | `annotation/annotation-list#state-empty` |
| `#空的與找不到` | `annotation/annotation-list#state-filtered-empty` |
| `#空的與找不到` | `annotation/annotation-list#state-task-not-found` |
| `#規格` | `annotation/annotation-list#role-project-leader` |
| `#規格` | `annotation/annotation-list#state-default` |
| `#試標歷史回饋` | `annotation/annotation-list#state-dry-run-feedback` |
| `#路由上下文與回退` | `annotation/annotation-list#param-run-type` |
| `#路由上下文與回退` | `annotation/annotation-list#state-no-task` |

## `docs/specs/04-annotation/02-annotation-workspace.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#三向決策` | `annotation/annotation-workspace#state-review-decision` |
| `#仲裁版面仲裁者選邊不重新標記` | `annotation/annotation-workspace#state-arbitration` |
| `#儲存草稿與提交` | `annotation/annotation-workspace#toast-saved` |
| `#右欄說明與檔案操作紀錄` | `annotation/annotation-workspace#tab-guideline` |
| `#審核卡兩個標記階段同一套版面` | `annotation/annotation-workspace#role-reviewer` |
| `#審核狀態軌` | `annotation/annotation-workspace#modal-review-flow` |
| `#工作區的外殼三欄與行動版` | `annotation/annotation-workspace#modal-mobile-drawer` |
| `#指引閘門第一次進來先讀說明` | `annotation/annotation-workspace#modal-guideline-gate` |
| `#操作紀錄裡的每一筆事件` | `annotation/annotation-workspace#tab-history` |
| `#最終例外池是最後一道出口` | `annotation/annotation-workspace#state-exception-pool` |
| `#規格` | `annotation/annotation-workspace#role-annotator` |
| `#規格` | `annotation/annotation-workspace#state-submitted-next` |
| `#說明檔案的三種預覽` | `annotation/annotation-workspace#modal-guideline-image` |
| `#說明檔案的三種預覽` | `annotation/annotation-workspace#modal-guideline-md` |
| `#說明檔案的三種預覽` | `annotation/annotation-workspace#modal-guideline-pdf` |

## `docs/specs/05-dataset/01-analysis-list.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#四種互斥的頁面狀態` | `dataset/dataset-analysis-list#param-error` |
| `#規格` | `dataset/dataset-analysis-list#state-default` |
| `#邊界情況edge-case` | `dataset/dataset-analysis-list#param-invalid-task` |
| `#邊界情況edge-case` | `dataset/dataset-analysis-list#param-view-empty` |
| `#邊界情況edge-case` | `dataset/dataset-analysis-list#state-filtered-empty` |

## `docs/specs/05-dataset/02-analysis-detail.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#八種輸出類型各自的主指標與門檻` | `dataset/dataset-analysis-detail#state-quality-entity-recognition` |
| `#八種輸出類型各自的主指標與門檻` | `dataset/dataset-analysis-detail#state-quality-free-text` |
| `#八種輸出類型各自的主指標與門檻` | `dataset/dataset-analysis-detail#state-quality-multi-dim` |
| `#八種輸出類型各自的主指標與門檻` | `dataset/dataset-analysis-detail#state-quality-multi-label` |
| `#八種輸出類型各自的主指標與門檻` | `dataset/dataset-analysis-detail#state-quality-relation-identification` |
| `#八種輸出類型各自的主指標與門檻` | `dataset/dataset-analysis-detail#state-quality-sequence-tagging` |
| `#八種輸出類型各自的主指標與門檻` | `dataset/dataset-analysis-detail#state-quality-single-dim` |
| `#八種輸出類型各自的主指標與門檻` | `dataset/dataset-analysis-detail#state-quality-single-label` |
| `#分頁列與網址上的分頁參數` | `dataset/dataset-analysis-detail#tab-quality` |
| `#分頁列與網址上的分頁參數` | `dataset/dataset-analysis-detail#tab-stats` |
| `#品質指標就緒訊號` | `dataset/dataset-analysis-detail#param-q-state-ready` |
| `#品質指標就緒訊號` | `dataset/dataset-analysis-detail#param-q-state-report-failed` |
| `#品質指標就緒訊號` | `dataset/dataset-analysis-detail#param-q-state-report-generating` |
| `#品質指標就緒訊號` | `dataset/dataset-analysis-detail#param-q-state-report-pending` |
| `#品質監控要先有試標才有東西看` | `dataset/dataset-analysis-detail#param-q-state-dry-run-in-progress` |
| `#單一標籤的統計` | `dataset/dataset-analysis-detail#state-stats-single-label` |
| `#單維度的統計` | `dataset/dataset-analysis-detail#state-stats-single-dim` |
| `#多標籤的統計` | `dataset/dataset-analysis-detail#state-stats-multi-label` |
| `#多維度的統計` | `dataset/dataset-analysis-detail#state-stats-multi-dim` |
| `#實體辨識的統計` | `dataset/dataset-analysis-detail#state-stats-entity-recognition` |
| `#序列標註的統計` | `dataset/dataset-analysis-detail#state-seq-match-partial` |
| `#序列標註的統計` | `dataset/dataset-analysis-detail#state-seq-match-strict` |
| `#序列標註的統計` | `dataset/dataset-analysis-detail#state-stats-sequence-tagging` |
| `#自由文字的統計` | `dataset/dataset-analysis-detail#state-stats-free-text` |
| `#載入失敗只換掉內容區` | `dataset/dataset-analysis-detail#param-error` |
| `#邊界情況edge-case` | `dataset/dataset-analysis-detail#state-stats-empty` |
| `#關係識別的統計` | `dataset/dataset-analysis-detail#state-stats-relation-identification` |

## `docs/specs/05-dataset/03-ingestion-lineage.mdx`

沒有視圖指向它。原因：該頁 §已確認決議 Q1（維護者 2026-11-08 裁定）刻意不補畫面；入口在 03-02 第一步、出口在 03-03 的試標發布。

## `docs/specs/06-admin/01-user-management.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#規格` | `admin/user-management#modal-audit-log` |
| `#規格` | `admin/user-management#modal-edit` |
| `#規格` | `admin/user-management#modal-invite` |
| `#規格` | `admin/user-management#state-default` |
| `#規格` | `admin/user-management#toast-action` |
| `#邊界情況edge-case` | `admin/user-management#state-filtered-empty` |

## `docs/specs/06-admin/02-role-settings.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#卡控機制` | `admin/role-settings#state-dirty` |
| `#取消要先確認` | `admin/role-settings#modal-dirty` |
| `#操作紀錄抽屜` | `admin/role-settings#modal-audit-log` |
| `#規格` | `admin/role-settings#state-default` |
| `#規格` | `admin/role-settings#toast-saved` |
| `#讀回的矩陣不合法時` | `admin/role-settings#state-stored-invalid` |
| `#邊界情況edge-case` | `admin/role-settings#state-conflict` |

## `docs/specs/07-shared/01-sidebar.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#規格` | `shared/app-shell#modal-shortcut` |
| `#規格` | `shared/app-shell#role-super-admin` |
| `#規格` | `shared/app-shell#state-active-task-type` |
| `#規格` | `shared/app-shell#state-admin-submenu-open` |
| `#規格` | `shared/app-shell#state-lang-en` |
| `#規格` | `shared/app-shell#state-logout` |
| `#規格` | `shared/app-shell#state-mobile` |
| `#規格` | `shared/app-shell#state-sidebar-collapsed` |
| `#規格` | `shared/app-shell#state-theme-dark` |
| `#規格` | `shared/app-shell#state-user-chip` |

## `docs/specs/07-shared/02-workspace-tabs.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#規格` | `shared/app-shell#param-ap-stage` |
| `#規格` | `shared/app-shell#state-workspace-tabs` |

## `docs/specs/07-shared/03-denied-and-not-found.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#規格` | `task-management/task-detail#sim-403` |
| `#規格` | `task-management/task-list#param-unauthorized` |

## `docs/specs/07-shared/04-notification-events.mdx`

| 章節錨點 | 視圖 |
| :--- | :--- |
| `#規格` | `shared/app-shell#modal-notification` |
