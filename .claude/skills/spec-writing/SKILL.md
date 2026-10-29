---
name: spec-writing
description: Write or revise the Label Suite PRD (docs/00-prd.mdx) and module specs (docs/specs/NNN-*.mdx) with the fixed chapter skeleton, writing style, and legacy ID mapping, then run the structure checker. Use when drafting, rewriting, or reviewing any file under docs/ that describes product requirements or a module, or when porting a legacy spec into docs/specs/.
---

# Spec Writing

Label Suite keeps two layers of specification:

| Layer | Path | Owner | Purpose |
|-------|------|-------|---------|
| Product docs | `docs/00-prd.mdx`, `docs/specs/NNN-*.mdx` | Maintainer | What the product does and why. Agents may draft and fix wording, but never change a requirement without the maintainer's decision. |
| OpenSpec | `openspec/specs/`, `openspec/changes/` | Agents, via change deltas | The testable contract that implementation and tests follow. |

When the two disagree, the product docs win, and the disagreement becomes an open question in the spec's `## 待釐清` chapter. Do not resolve it silently in either layer.

This skill covers the product docs layer. Read `AGENTS.md` first; its language rules apply.

## Workflow

1. Read the PRD, the module's current spec (if any), and the prototype pages it covers.
2. Start from the template: [references/prd-template.mdx](references/prd-template.mdx) or [references/spec-template.mdx](references/spec-template.mdx). Keep every chapter, even when it only says `無`.
3. Write the content under the rules below.
4. When porting a legacy spec, follow [Legacy mapping](#legacy-mapping).
5. Run `node scripts/check-specs.mjs` (or `corepack pnpm run check:specs`) and fix every `ERROR`.
6. Re-read the result against the [style checklist](#style-checklist); the script cannot check style.
7. Put every decision the maintainer still owes into `## 待釐清`, and ask the maintainer with AskUserQuestion instead of choosing a default.

## PRD skeleton

`docs/00-prd.mdx` has exactly these 14 H2 chapters, in this order. Chapters may be numbered (`## 3. 使用者角色`).

| # | Chapter | Holds |
|---|---------|-------|
| 1 | 文件資訊 | Version, status, owner, last update |
| 2 | 專案概述 | Problem, goals, success measures |
| 3 | 使用者角色 | Every role and what it may do, at the coarsest grain |
| 4 | 專案範圍 | In scope and out of scope, as two lists |
| 5 | 網站地圖 | The page tree, matching the prototype sidebar |
| 6 | 業務流程 | End-to-end flows across modules |
| 7 | 規格說明 | An index of `docs/specs/` files, one row per module |
| 8 | 非功能需求 | Performance, security, privacy, accessibility, test-set protection |
| 9 | 外部整合與依賴 | Services, models, and data sources the product depends on |
| 10 | 時程 | Milestones |
| 11 | 技術選型 | Stack decisions, with the reason for each |
| 12 | 術語表 | Every term definition (see [Terms](#terms)) |
| 13 | 待釐清事項 | A pointer to the open questions in each spec; no questions are kept here |
| 14 | 變更紀錄 | Dated entries, newest first |

## Module spec skeleton

Each module is one file, `docs/specs/NNN-<kebab-name>.mdx`, where `NNN` is a three-digit number. It has exactly these nine H2 chapters, in this order, plus the optional legacy appendix as the last chapter.

| # | Chapter | Holds |
|---|---------|-------|
| 1 | 目標 | What the module lets each role achieve, in two to four sentences |
| 2 | 使用權限 | A role × action table. Permissions may only narrow what the PRD grants, never widen it. |
| 3 | 操作流程 | The main flow and its branches, as numbered steps or a Mermaid diagram |
| 4 | 資料模型 | Entities, fields, constraints, and state transitions the module owns |
| 5 | 規格 | Requirements (`FR-NNN`), one H3 section per prototype sidebar page |
| 6 | 卡控機制 | Guards against invalid or unsafe input, each in three layers |
| 7 | 驗收標準 | Acceptance scenarios (`AC-N.N`) as a Given/When/Then table |
| 8 | 待釐清 | Open questions, numbered `NNN-Qn` |
| 9 | 決策紀錄 | Dated one-line decisions, newest first |
| (opt.) | 附錄：舊條文對照 | Only for a spec ported from a legacy spec |

### Chapter 5: one section per page

Split `## 規格` by the pages in the prototype sidebar, and name each H3 after the sidebar path, group first: `### 專案管理 › 任務設定`. A page that no requirement touches does not get a section. A requirement that spans pages goes in the first page where a user meets it, and the other pages reference its ID.

### Requirements state constraints, not appearance

A requirement says what must hold, not how the screen looks. Layout, color, and component choice belong to the prototype.

| Write | Instead of |
|-------|-----------|
| 任務名稱須唯一，以利標註員在清單中辨識任務。 | 任務名稱欄位放在表單最上方，使用紅色星號。 |
| 送出後應保留已填內容，讓標註員修正錯誤後不必重填。 | 送出按鈕在右下角。 |

### Four-way mapping

Every block of a prototype page must be traceable in four places. Before finishing, walk each page and confirm each block has:

1. a requirement in `## 規格`,
2. a guard in `## 卡控機制`, or an explicit `無` with the reason,
3. an acceptance scenario in `## 驗收標準`,
4. or, when any of the above is undecided, an entry in `## 待釐清`.

A block that appears in none of the four is a gap; add an open question rather than inventing behavior.

### Guards: three layers

Each entry in `## 卡控機制` names the rule and then covers three layers:

- **前端**: what the page prevents or warns about before submitting.
- **後端**: what the API rejects, and with which error. The backend check is required even when the frontend already blocks the input.
- **例外**: who may bypass the guard, or `無`.

Guards that protect test-set answers (`AGENTS.md` hard rule 6) state the backend layer explicitly, since a hidden field on the page is not protection.

### Acceptance: one table per requirement group

```mdx
| ID | Given | When | Then |
| --- | --- | --- | --- |
| AC-1.1 | 標註員已登入且被指派任務 | 開啟任務清單 | 只看到被指派的任務 |
```

`AC-N.M`: `N` groups scenarios (usually one group per chapter 5 section), `M` counts within the group. Each `FR` is covered by at least one `AC`.

### Open questions

Number each question `NNN-Qn` with the spec's number (`006-Q3`). The PRD's `## 待釐清事項` does not repeat them; it points to each spec's chapter. When a question is answered, delete it from `## 待釐清`, apply the answer to the relevant chapters, and add a line to `## 決策紀錄`.

### Decision log

Group entries under a date heading, newest first, one line per decision:

```mdx
### 2026-10-29

- 匯出格式只支援 JSONL，以利下游訓練流程直接讀取（006-Q2）。
```

## IDs

The numbering inherited from the legacy specs stays:

| Prefix | Meaning | Shape | Defined where |
|--------|---------|-------|---------------|
| `FR` | Functional requirement | `FR-001`, sub-items `FR-004a` | `- **FR-001**：…` in `## 規格` |
| `SC` | Success criterion | `SC-001` | `- **SC-001**：…` in `## 目標` |
| `AC` | Acceptance scenario | `AC-1.1` | First cell of a `## 驗收標準` table row |

- An ID is defined once per spec; anywhere else it is a reference written bare (`見 FR-004`).
- IDs are never reused within a spec, even after deletion; gaps are fine.
- Different specs may use the same ID; refer across specs with the file name (`006 的 FR-002`).

## Terms

Define each domain term once, in the PRD's `## 術語表`:

```mdx
::::define{id="term.標註員" label="標註員"}
被指派任務、負責產出標註結果的使用者。
::::
```

Mark the first use of a term in each chapter with a reference, and write later uses as plain text:

```mdx
:ref[標註員]{id="term.標註員"} 只能看到被指派的任務。
```

A reference to an undefined term fails the checker. Add the definition before using the term.

## Legacy mapping

Porting a legacy spec must not lose a requirement silently. For each ported spec:

1. Snapshot the legacy IDs once:
   ```sh
   node scripts/check-specs.mjs --extract-legacy <legacy spec.md> > docs/specs/legacy/NNN-<name>.ids
   ```
   The `.ids` file name matches the new spec's file name. Review it and commit it; it is the list the checker holds the mapping to.
2. End the spec with the appendix, one row per legacy ID:
   ```mdx
   ## 附錄：舊條文對照

   | 舊編號 | 新位置 | 說明 |
   | --- | --- | --- |
   | FR-001 | FR-001 | |
   | FR-002 | 卡控機制 | 改寫為任務名稱唯一的卡控 |
   | FR-003 | 刪除 | 與 FR-001 重複 |
   ```
3. `新位置` is an ID this spec defines, a chapter name, or `刪除`. A `刪除` row always gives the reason in `說明`.

The checker fails when a legacy ID is missing, mapped twice, mapped to an undefined ID, or deleted without a reason.

## Writing style

These rules apply to the Chinese text in `docs/`.

1. **State rules, do not address the reader.** Write `標註員應…`, not `你需要…` or `請…`.
2. **Every rule carries its purpose.** Add a clause with `讓…` or `以利…` that says what the rule makes possible: `匯出檔須包含任務版本，以利重現訓練資料。`
3. **Purposes look forward.** Say what the rule enables, not what went wrong before. Write `以利稽核`, not `因為之前出過錯`.
4. **No dashes.** Do not use `——` or `—`. Split the sentence, or use `：` before a list or explanation.
5. **Bold only terms and scope qualifiers.** Bold a term at its definition or a qualifier that changes the rule's scope (`**僅限**管理員`). Do not bold for emphasis.
6. **Layer long sentences with `；`.** One condition per clause: `任務已關閉時，標註員不得送出結果；管理員可以重新開啟任務。`
7. **Use the four modal verbs.** `應` (expected behavior), `須` (hard requirement), `不得` (prohibition), `可以` (permission). Do not write `SHALL` or `MUST` in `docs/`. OpenSpec deltas under `openspec/` keep `SHALL` / `MUST`, since OpenSpec parses them.

## Style checklist

The checker verifies chapters, terms, IDs, and the legacy mapping. Check the rest by reading:

- [ ] No `——` or `—` in the text (`rg '—' docs/`).
- [ ] No `你` / `請` addressing the reader.
- [ ] Each rule has a `讓` / `以利` purpose clause.
- [ ] Bold is used only for terms and scope qualifiers.
- [ ] No layout or color in `## 規格`.
- [ ] Every prototype block passes the four-way mapping.
- [ ] Permissions in `## 使用權限` are no wider than the PRD's.
- [ ] Every `FR` has at least one `AC`.
