# Spec Delta

## MODIFIED Requirements

### Requirement: 沒有任務角色時從側欄進入標記作業被擋下

第三個導覽項的連結 SHALL 指向 `/annotation/annotation-list?entry=nav`，MUST NOT 帶任務、任務類型或輸出類型。使用者在任何任務都沒有任務角色時，從側欄一般點擊它 SHALL 被擋下：回到 `/dashboard/dashboard`，在落點頁的頁首正下方、版面內容之上顯示一次說明「你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。」（英文介面為對應的英文）。說明 MUST NOT 帶任務名稱或任務 ID、MUST NOT 進網址，重新整理、上一頁、下一頁之後不再出現。

來源：規格 07-01 §進入模組的條件 第 1、3 條與註、§卡控機制 第 2、5 列、§已確認決議 Q6、Q17、Q20、Q22；規格 02-01 §這一頁顯示哪一種版面 第 6 條；Scenario「沒有任務角色時點擊標記作業」；sidebar-nav clarification Q1、Q4；dashboard-shell clarification Q4。

#### Scenario: 沒有任務角色時點擊標記作業

- **WHEN** 沒有任何任務角色的平台成員停在 `/dashboard/dashboard`，從側欄點「標記作業」
- **THEN** 網址是 `/dashboard/dashboard`，沒有 query string，沒有進入標記清單；說明「你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。」只出現一次，位在頁首（主標題「儀表板」與副標題）之後、版面內容（「開始你的第一個工作流程」）之前
- **AND** 「標記作業」連結的目標是 `/annotation/annotation-list?entry=nav`，不含 `task_type` 或任何任務識別
- **AND** 重新整理頁面之後，說明不再出現

### Requirement: 側欄的語言切換讓整頁一起換

側欄 SHALL 提供語言切換（寬度 767px 以下在上方品牌列）。點擊後側欄的導覽項、次選單、快捷鍵總覽、角色標示、圖示型控制項與區域的可存取名稱，以及目前頁面的內容，同時換成另一種語言，並記住選擇。

來源：規格 07-01 §語言切換 第 1–4 條；Scenario「切換語言後整頁一起換」；sidebar-nav clarification P2；dashboard-shell clarification「交給後續產出」（目前頁面由暫時落點換成儀表板）。

#### Scenario: 切換語言後整頁一起換

- **WHEN** 介面語言為繁體中文，平台成員停在 `/dashboard/dashboard`，點側欄的語言切換
- **THEN** 導覽項依序為「Dashboard」「Task Management」「Annotation」「Dataset Analytics」「Profile」，頁面的主標題同時變成「Dashboard」
- **AND** 外觀切換的可存取名稱為「Switch to dark mode」或「Switch to light mode」、快捷鍵入口為「Keyboard shortcuts」、登出為「Sign out」、主導覽區為「Main navigation」、工具列為「Global tools」、個人設定連結為「Go to Profile」
