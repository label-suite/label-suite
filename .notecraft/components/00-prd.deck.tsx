import type { CustomSlideProps, Deck, SeriesTone } from "@/lib/decks";
import { Roster, Triad } from "@/components/deck/blocks";
import { DGAP, DS, DTRACK } from "@/components/deck/scale";
import { toneColor } from "@/components/deck/SlideChrome";
import { dkt } from "@/components/deck/theme";
import ArchitectureContainerView from "@notes/components/architecture-container-view";
import PrdSystemContext from "@notes/components/prd-system-context";
import PrdTaskLifecycleFlow from "@notes/components/prd-task-lifecycle-flow";

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

// PART 02 — 六項目標依受益角色分三組：上方色帶標角色，每張卡以一個大字寫出驗收門檻。
type GoalGroup = { label: string; tone: SeriesTone; goals: { value: string; goal: string; measure: string }[] };

const GOAL_GROUPS: GoalGroup[] = [
  {
    label: "專案負責人",
    tone: "blue",
    goals: [
      { value: "端到端", goal: "走完一次完整標記流程", measure: "能實際示範從建任務到匯出" },
      { value: "≥ 5 種", goal: "換任務不改平台", measure: "研究示例只靠任務設定建立" },
      { value: "步驟更少", goal: "建任務步驟比現有工具少", measure: "操作步驟數少於 Label Studio" },
      { value: "2–3 個", goal: "向論文讀者重現使用情境", measure: "示範影片呈現的情境數" },
    ],
  },
  {
    label: "專案負責人、審核員",
    tone: "orange",
    goals: [{ value: "100%", goal: "標記中就看到資料統計", measure: "句詞標籤統計與人工計算一致" }],
  },
  {
    label: "標記員、審核員",
    tone: "muted",
    goals: [{ value: "SUS ≥ 75", goal: "平台好上手", measure: "5–10 位實驗室成員填寫的整體分數" }],
  },
];

function GoalsPage({ dark }: CustomSlideProps) {
  const c = dkt(dark);
  const total = GOAL_GROUPS.reduce((n, g) => n + g.goals.length, 0);
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(${total}, 1fr)`,
        gridTemplateRows: "auto 1fr",
        columnGap: DGAP.sm,
        rowGap: DGAP.xs,
      }}
    >
      {GOAL_GROUPS.map((g) => {
        const t = toneColor(g.tone, c);
        // muted 是標記色、不是文字色；灰色組的文字改穿正文 token 才讀得清楚。
        const ink = g.tone === "muted" ? c.body : t.fg;
        return (
          <div
            key={g.label}
            style={{
              gridColumn: `span ${g.goals.length}`,
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              background: t.soft,
              color: ink,
              fontSize: DS.micro,
              fontWeight: 800,
              letterSpacing: DTRACK.label,
              textAlign: "center",
            }}
          >
            {g.label}
          </div>
        );
      })}
      {GOAL_GROUPS.flatMap((g) => {
        const t = toneColor(g.tone, c);
        const ink = g.tone === "muted" ? c.body : t.fg;
        return g.goals.map((it) => (
          <div
            key={it.goal}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: DGAP.sm,
              padding: DGAP.md,
              borderRadius: "var(--radius-md)",
              background: dark ? c.sunken : "var(--neutral-50)",
              border: `1px solid ${c.borderSoft}`,
              borderTop: `4px solid ${t.fg}`,
            }}
          >
            <div style={{ minHeight: "2.7em", fontSize: DS.h4, fontWeight: 800, lineHeight: 1.35, color: c.ink, textWrap: "balance" }}>
              {it.goal}
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                fontSize: 48,
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: DTRACK.tight,
                color: ink,
                whiteSpace: "nowrap",
              }}
            >
              {it.value}
            </div>
            <div style={{ minHeight: "3em", fontSize: DS.small, lineHeight: 1.5, color: c.body, textWrap: "balance" }}>
              {it.measure}
            </div>
          </div>
        ));
      })}
    </div>
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
      meta: ["由 docs/specs/00-prd.mdx 生成", "8 頁 · 16:9"],
      agenda: [
        { n: "01", title: "問題與定位", sub: "三個痛點，一個論文目標" },
        { n: "02", title: "六項目標", sub: "怎麼衡量做到了" },
        { n: "03", title: "六個角色", sub: "系統角色與任務角色互不影響" },
        { n: "04", title: "系統架構", sub: "C4 第一層與第二層" },
        { n: "05", title: "任務生命週期", sub: "三個模組之間的六次交接" },
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
      render: GoalsPage,
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
