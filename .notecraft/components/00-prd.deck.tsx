import { ArrowLeft, ArrowRight, ClipboardCheck, Crown, KeyRound, PenLine, ShieldCheck, User } from "lucide-react";
import type { CustomSlideProps, Deck } from "@/lib/decks";
import { Triad } from "@/components/deck/blocks";
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

// PART 02 — 一人兩軸：左邊系統角色（全平台恰一個），右邊同一人在不同任務各有任務角色。
// 圖示與 prd-site-map 的 ROLES 一致。
type RoleIcon = typeof User;

const SYSTEM_ROLES: { label: string; icon: RoleIcon; note: string }[] = [
  { label: "平台成員", icon: User, note: "自行註冊或受邀加入" },
  { label: "系統管理員", icon: ShieldCheck, note: "管理帳號與角色權限" },
];

const TASK_SAMPLES: { task: string; role: string; icon: RoleIcon; note: string }[] = [
  { task: "任務 A", role: "專案負責人", icon: Crown, note: "建立任務的人自動取得" },
  { task: "任務 B", role: "標記員", icon: PenLine, note: "看不到標準答案" },
  { task: "任務 C", role: "審核員", icon: ClipboardCheck, note: "同時擔任仲裁者" },
];

function RolesPage({ dark }: CustomSlideProps) {
  const c = dkt(dark);
  const sys = toneColor("blue", c);
  const task = toneColor("orange", c);

  const panel = (t: { fg: string; soft: string }) => ({
    display: "flex",
    flexDirection: "column" as const,
    gap: DGAP.sm,
    padding: DGAP.md,
    borderRadius: "var(--radius-lg)",
    background: dark ? c.sunken : "var(--neutral-50)",
    border: `1px solid ${c.borderSoft}`,
    borderTop: `4px solid ${t.fg}`,
  });
  const head = (t: { fg: string }, title: string, sub: string) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: DGAP.sm, flexWrap: "wrap" }}>
      <span style={{ fontSize: DS.h3, fontWeight: 900, color: t.fg }}>{title}</span>
      <span style={{ fontSize: DS.small, fontWeight: 700, color: c.body }}>{sub}</span>
    </div>
  );
  const foot = (text: string) => (
    <div style={{ marginTop: "auto", paddingTop: DGAP.xs, borderTop: `1px dashed ${c.border}`, fontSize: DS.small, color: c.body }}>
      {text}
    </div>
  );
  const chip = (t: { fg: string; soft: string }, Icon: RoleIcon, label: string, note: string, size = 30) => (
    <div style={{ display: "flex", alignItems: "center", gap: DGAP.sm, minWidth: 0 }}>
      <span
        style={{
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size + 22,
          height: size + 22,
          borderRadius: 999,
          background: t.soft,
          color: t.fg,
        }}
      >
        <Icon size={size} strokeWidth={2.2} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: DS.h4, fontWeight: 800, color: c.ink }}>{label}</span>
        <span style={{ fontSize: DS.small, color: c.body }}>{note}</span>
      </span>
    </div>
  );
  const arrow = (Icon: RoleIcon, t: { fg: string }, label: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: t.fg }}>
      <Icon size={48} strokeWidth={2.4} />
      <span style={{ fontSize: DS.small, fontWeight: 800, letterSpacing: DTRACK.label }}>{label}</span>
    </div>
  );

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto auto auto minmax(0, 1.15fr)",
        alignItems: "stretch",
        columnGap: DGAP.md,
      }}
    >
      <div style={panel(sys)}>
        {head(sys, "系統角色", "全平台・每人恰一個")}
        {chip(sys, SYSTEM_ROLES[0].icon, SYSTEM_ROLES[0].label, SYSTEM_ROLES[0].note)}
        <div style={{ display: "flex", alignItems: "center", gap: DGAP.xs, color: c.muted, fontSize: DS.small, fontWeight: 700 }}>
          <span style={{ flex: 1, borderTop: `1px solid ${c.border}` }} />或<span style={{ flex: 1, borderTop: `1px solid ${c.border}` }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: DGAP.sm, padding: DGAP.sm, borderRadius: "var(--radius-md)", border: `1.5px solid ${sys.fg}` }}>
          {chip(sys, SYSTEM_ROLES[1].icon, SYSTEM_ROLES[1].label, SYSTEM_ROLES[1].note)}
          <div style={{ marginLeft: DGAP.lg, padding: DGAP.xs, borderRadius: "var(--radius-sm)", border: `1px dashed ${sys.fg}` }}>
            {chip(sys, KeyRound, "Seeder 管理員", "部署時建立，不能停用或移除", 22)}
          </div>
        </div>
        {foot("決定：帳號、系統管理、看得到哪些任務列表")}
      </div>

      {arrow(ArrowLeft, sys, "擇一")}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: DGAP.xs }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 132,
            height: 132,
            borderRadius: 999,
            background: c.slide,
            border: `3px solid ${c.ink}`,
            color: c.ink,
          }}
        >
          <User size={64} strokeWidth={2} />
        </span>
        <span style={{ fontSize: DS.h4, fontWeight: 900, color: c.ink }}>同一個人</span>
      </div>

      {arrow(ArrowRight, task, "依任務")}

      <div style={panel(task)}>
        {head(task, "任務角色", "只在自己參與的任務・每個任務各自指定")}
        <div style={{ display: "flex", flexDirection: "column", gap: DGAP.sm, flex: 1, justifyContent: "center" }}>
          {TASK_SAMPLES.map((it) => (
            <div key={it.task} style={{ display: "flex", alignItems: "center", gap: DGAP.sm }}>
              <span
                style={{
                  flex: "none",
                  width: 96,
                  padding: "6px 0",
                  textAlign: "center",
                  borderRadius: "var(--radius-sm)",
                  background: c.slide,
                  border: `1px solid ${c.border}`,
                  fontSize: DS.small,
                  fontWeight: 800,
                  color: c.body,
                }}
              >
                {it.task}
              </span>
              <span style={{ flex: "none", width: 24, borderTop: `2px solid ${task.fg}` }} />
              {chip(task, it.icon, it.role, it.note)}
            </div>
          ))}
        </div>
        {foot("決定：能不能進任務詳情、標記、審核與分析")}
      </div>
    </div>
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
      meta: ["由 docs/specs/00-prd.mdx 生成", "7 頁 · 16:9"],
      agenda: [
        { n: "01", title: "問題與定位", sub: "三個痛點，一個論文目標" },
        { n: "02", title: "六個角色", sub: "系統角色與任務角色互不影響" },
        { n: "03", title: "系統架構", sub: "C4 第一層與第二層" },
        { n: "04", title: "任務生命週期", sub: "三個模組之間的六次交接" },
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
      nav: "六個角色",
      num: "02",
      eyebrow: "PART 02 · 使用者角色",
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
