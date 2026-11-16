import type { CustomSlideProps, Deck } from "@/lib/decks";
import { Compare, Roster, Table, Triad } from "@/components/deck/blocks";
import ArchitectureContainerView from "@notes/components/architecture-container-view";
import PrdSystemContext from "@notes/components/prd-system-context";
import PrdTaskLifecycleFlow from "@notes/components/prd-task-lifecycle-flow";
import PrdTaskState from "@notes/components/prd-task-state";

// PART 01 — 三個卡住現有流程的問題，收斂成一句要證明的事。
function ProblemsPage({ dark }: CustomSlideProps) {
  return (
    <Triad
      dark={dark}
      statement="設定驅動的標記流程，是這篇 Demo Paper 要證明的事"
      emphasis="設定驅動的標記流程"
      items={[
        {
          label: "工具分散",
          desc: "建任務、標記、品質分析分屬不同工具，資料搬動、流程難重現",
        },
        {
          label: "門檻太高",
          desc: "換一種研究任務就要重新學設定方式、或請工程師改程式",
        },
        {
          label: "品質太晚才看到",
          desc: "標記全部做完才發現規則理解不一致，只能整批重標",
        },
      ]}
    />
  );
}

// PART 02 — 六項目標 × 受益角色 × 衡量方式的交叉表。
function GoalsTablePage({ dark }: CustomSlideProps) {
  return (
    <Table
      dark={dark}
      head={["目標", "受益角色", "衡量方式"]}
      rows={[
        [{ text: "走完一次完整標記流程" }, { text: "專案負責人" }, { text: "能實際示範建任務到匯出" }],
        [{ text: "換任務不改平台" }, { text: "專案負責人" }, { text: "至少五種研究示例只靠任務設定建立" }],
        [{ text: "建任務步驟比現有工具少" }, { text: "專案負責人" }, { text: "操作步驟數少於 Label Studio" }],
        [
          { text: "標記中就看到資料統計" },
          { text: "專案負責人、審核員" },
          { text: "句詞標籤統計與人工計算完全一致" },
        ],
        [{ text: "平台好上手" }, { text: "標記員、審核員" }, { text: "5–10 位實驗室成員填 SUS、整體 ≥ 75 分" }],
        [{ text: "向論文讀者重現使用情境" }, { text: "專案負責人" }, { text: "示範影片呈現 2–3 個情境" }],
      ]}
    />
  );
}

// PART 03 — 一個中心（一人多角色）+ 六個無先後順序的角色。
function RolesPage({ dark, area }: CustomSlideProps) {
  return (
    <Roster
      dark={dark}
      width={area.w}
      height={area.h}
      lead="一人有一個系統角色 × 多個任務角色，兩者互不影響"
      center={{ label: "一人多角色", note: "系統角色 × 任務角色並存" }}
      actors={[
        { label: "平台成員", role: "自行註冊或受邀加入，建立並參與任務", icon: "users" },
        { label: "系統管理員", role: "管理帳號與角色權限，可看所有任務列表", icon: "settings" },
        { label: "Seeder 管理員", role: "部署時建立的第一位系統管理員，不能被停用或移除", icon: "database" },
        { label: "專案負責人", role: "設定任務、指派成員，推進試標與正式標記", icon: "target" },
        { label: "審核員", role: "審核標記結果，處理爭議與仲裁", icon: "check" },
        { label: "標記員", role: "在被指派的資料上產出標記，看不到標準答案" },
      ]}
    />
  );
}

// PART 04 — 範圍內／範圍外兩份並列清單的對照，不給建議徽章（這是已拍板的邊界，不是互相競爭的方案）。
function ScopePage({ dark }: CustomSlideProps) {
  return (
    <Compare
      dark={dark}
      axis="邊界"
      left={{
        tag: "範圍內",
        name: "六大核心模組",
        tone: "blue",
        rows: [
          ["01", "帳號"],
          ["02", "儀表板"],
          ["03", "任務管理"],
          ["04", "標記作業"],
          ["05", "資料集"],
          ["06", "系統管理"],
        ],
      }}
      right={{
        tag: "範圍外",
        name: "六項排除，另兩項見註腳",
        tone: "orange",
        rows: [
          ["批次匯入精靈", "部署者這期直接匯入"],
          ["AI 輔助標記建議", "列為未來工作"],
          ["標準格式匯出", "CoNLL／BIO／JSON-L，未來工作"],
          ["並發壓力測試", "研究原型，非生產規模"],
          ["第三方系統整合", "這期以展示平台能力為主"],
          ["手機原生 App", "網頁應用，用瀏覽器操作"],
        ],
      }}
    />
  );
}

const deck: Deck = {
  slug: "specs/00-prd",
  title: "Label Suite：給學術 NLP 團隊的標記與品質平台",
  eyebrow: "PRODUCT · 定稿",
  generatedAt: "2026-11-15",
  source: "docs/specs/00-prd.mdx",
  slides: [
    {
      layout: "cover",
      nav: "封面",
      eyebrow: "PRODUCT · 定稿",
      title: "Label Suite：給學術 NLP 團隊的標記與品質平台",
      subtitle: "一個設定驅動的平台，走完試標、正式標記、審核與資料品質分析",
      meta: ["由 docs/specs/00-prd.mdx 生成", "10 頁 · 16:9"],
      agenda: [
        { n: "01", title: "問題與定位", sub: "三個痛點，一個論文目標" },
        { n: "02", title: "六項目標", sub: "怎麼衡量做到了" },
        { n: "03", title: "六個角色", sub: "系統角色與任務角色互不影響" },
        { n: "04", title: "範圍邊界", sub: "這期做什麼、不做什麼" },
        { n: "05", title: "系統架構", sub: "C4 第一層與第二層" },
        { n: "06", title: "任務生命週期", sub: "六次交接、五個狀態" },
      ],
    },
    {
      layout: "custom",
      nav: "問題與定位",
      num: "01",
      eyebrow: "PART 01 · 專案概述",
      title: "三個卡住現有流程的問題，一篇論文要證明的事",
      render: ProblemsPage,
    },
    {
      layout: "custom",
      nav: "六項目標",
      num: "02",
      eyebrow: "PART 02 · 專案概述",
      title: "六項目標，每項都有可驗收的衡量方式",
      footnotes: [{ n: "1", text: "SUS 問卷在正式標記功能完成後才招募受試者，需預留填答與分析時間。" }],
      render: GoalsTablePage,
    },
    {
      layout: "custom",
      nav: "六個角色",
      num: "03",
      eyebrow: "PART 03 · 使用者角色",
      title: "六個角色，系統角色與任務角色互不影響",
      callout: {
        icon: "lock",
        text: "標記員能接觸到的任何地方，都看不到標準答案與測試集資訊",
        chip: "資料安全切割",
      },
      render: RolesPage,
    },
    {
      layout: "custom",
      nav: "範圍邊界",
      num: "04",
      eyebrow: "PART 04 · 專案範圍",
      title: "範圍已拍板：六大模組在內，AI 建議與手機 App 在外",
      pill: { text: "定稿範圍", tone: "blue" },
      footnotes: [
        { n: "1", text: "07 共用介面（側欄導覽、工作頁籤、語言切換）貫穿所有模組，不另外佔一列。" },
        {
          n: "2",
          text: "多語言僅排除「第三種以上」，繁中與英文切換仍在範圍內；說明按鈕這期不做，下一期依 SUS 問卷結果決定。",
        },
      ],
      callout: {
        icon: "alert",
        tone: "warning",
        text: "假設：任務類型完全由任務設定決定；不成立時目標二無法達成",
      },
      render: ScopePage,
    },
    {
      layout: "full-visual",
      nav: "系統情境：C4 第一層",
      title: "誰在用、碰到哪些外部系統：Google 與 Resend 都可不設定",
      viz: PrdSystemContext,
      vizLabel: "@ai-visualize · prd-system-context",
      vizHint: "點人或系統看互動；切換『部署設定』看 Google、Resend 未設定時的樣子。",
    },
    {
      layout: "full-visual",
      nav: "容器視圖：C4 第二層",
      title: "六個容器只有 Nginx 對外，測試集答案只有 worker 讀",
      viz: ArchitectureContainerView,
      vizLabel: "@ai-visualize · architecture-container-view",
      vizHint: "點容器看關係；切換『資料庫層』看 Lite 與正式部署的差異。",
    },
    {
      layout: "full-visual",
      nav: "任務生命週期：六次交接",
      title: "任務從建立到匯出：三個模組之間的六次交接",
      viz: PrdTaskLifecycleFlow,
      vizLabel: "@ai-visualize · prd-task-lifecycle-flow",
      vizHint: "選『逐步走查』依序看每個交接；A1／A2 是退回草稿或再開一輪試標的替代流程。",
    },
    {
      layout: "full-visual",
      nav: "任務的五個狀態",
      title: "任務只能往前走，唯一的回頭路在等待 IAA 確認",
      viz: PrdTaskState,
      vizLabel: "@ai-visualize · prd-task-state",
      vizHint: "點狀態看進入條件與推進的模組；唯一回頭路可退回草稿或再開一輪試標。",
    },
    {
      layout: "closing",
      nav: "回顧與下一步",
      title: "回顧：設定驅動的標記與品質平台",
      items: [
        { n: "01", k: "定位", v: "碩士論文 Demo Paper 的核心成果：設定驅動的標記流程" },
        { n: "02", k: "範圍", v: "七大模組、六個角色，標記員看不到標準答案" },
        { n: "03", k: "狀態", v: "任務單向推進，唯一回頭路在等待 IAA 確認" },
      ],
      cta: "回到筆記看完整規格、權限矩陣與術語表",
      ctaMeta: "/notes/specs/00-prd",
    },
  ],
};

export default deck;
