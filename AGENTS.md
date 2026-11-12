# AGENTS.md

The single rule source for every coding agent working in this repository (Claude Code, Codex, and others). `CLAUDE.md` imports this file and adds only Claude-specific rules; nothing here is repeated there.

## Hard Rules

1. **Issue first** — no implementation starts without an open issue that lists the work.
2. **No commits to `main`** — branch first (`<type>/<short-description>`, lowercase, `-` separated, e.g. `docs/agent-rules`), then open a pull request.
3. **No `pip install` / `npm install`** — use `uv add` for Python and `pnpm add` for JavaScript so lockfiles stay in sync.
4. **No version bumps** — do not change the version in `CITATION.cff`, `backend/pyproject.toml`, or `frontend/package.json`. The only exception is the `chore(release)` commit described in [docs/development/commit-and-release.md](docs/development/commit-and-release.md).
5. **No hardcoded task logic** — task types are config-driven; adding one must not require changing core code.
6. **No test-set answer exposure** — anything an annotator can reach must never include ground-truth answers.
7. **No `any` in TypeScript**, and **no `allow_origins=["*"]`** in CORS — list origins explicitly.
8. **No hardcoded secrets** — API keys and tokens come from environment variables.
9. **No unvalidated input** — validate and sanitize every user input before it reaches a query, a template, or a response, so SQL injection and XSS have nowhere to land.
10. **No unconfirmed destructive commands** — `rm -rf`, `git reset --hard`, `git push --force`, `git branch -D` need the maintainer's explicit confirmation first.

## Development Workflow

Every change follows the same four steps:

1. **Open an issue before implementing.** The issue lists every work item as a checkbox.
2. **Split large work into parent and child issues.** The parent's Issue Type is `Epic`; children are `Task`, `Bug`, or `Feature`. The parent lists its children and links them as GitHub sub-issues. Do not add words like "parent" to the title — the `Epic` type and the progress badge identify it.
3. **Tick every item when it is done.** Go back to the issue and check each item off, and do the same for the PR's Test Plan. An unchecked item means the work is not finished.
4. **Close the issue only after the PR is merged.** The PR body says `Closes #N`.

### Issue types and titles

| Situation | Issue Type | Label | Title |
|-----------|-----------|-------|-------|
| Bug, failing test, or error still unresolved after 2 retries | Bug | `bug` | `[Bug] <component>: <中文描述>` |
| New feature, workflow, page, or module | Feature | `feature` | `[Feature] <scope>: <中文描述>` |
| Change to an existing feature's behavior or screen | Feature | `enhancement` | `[Enhancement] <scope>: <中文描述>` |
| Work blocked by an unclear or missing requirement | Task | `task` | `[Task] <scope>: <中文描述>` |
| UI or styling change or defect | Feature | `ui` | `[UI] <scope>: <中文描述>` |
| Technical uncertainty blocking implementation | Task | `spike` | `[Spike] <scope>: <中文描述>` |
| Missing or incorrect documentation | Task | `docs` | `[Docs] <scope>: <中文描述>` |
| Usage question | Task | `question` | `[Question] <scope>: <中文描述>` |
| Production or staging incident | Bug | `incident` | `[Incident] <scope>: <中文描述>` |

Ready-to-copy `gh issue create` commands for each type are in [.github/issue-templates.md](.github/issue-templates.md).

**Security findings:** Critical or High vulnerabilities never go into a public issue. Report `SECURITY ESCALATION REQUIRED` to the maintainer with only the affected area and urgency, and wait for a private advisory. Medium and Low findings may be filed as normal Bug issues.

## Project Board and Dispatch

The organization project **Label Suite** (https://github.com/orgs/label-suite/projects/1) is the only record of an issue's state. Its `Status` field moves Todo → Ready → In Progress → In Review → Done. No labels track state.

- **Ready gate.** Only the maintainer moves an Epic to Ready. A child issue that maps to an item on its Epic's checklist counts as approved, **except when it changes a screen**: an issue that would change `design/prototype/` or any interface moves to Ready only after the maintainer has seen the proposed screen as an artifact and said it is fine (maintainer's instruction, 2026-11-10). Drawing the artifact is not permission to edit `design/prototype/`. New work outside any Epic checklist stays in Todo until the maintainer decides.
- **Dependencies.** Record them as GitHub issue dependencies (blocked-by), not only in the issue text. A child moves to Ready only when every issue blocking it is closed. The `blocked` label is reserved for external conditions, such as a directory that does not exist yet.
- **Claiming.** Before starting, move the card to In Progress and comment on the issue with the agent name and branch. Never pick up an issue that is already In Progress.
- **Card moves.** The agent doing the work moves its card: In Progress when claiming, In Review when the PR is open, Done after the PR is merged and the issue is closed. An Epic moves to In Progress when its first child starts and to Done when its last child is done.
- **Opening issues.** Pass everything in one command: `gh issue create --type <Type> --project "Label Suite"`, plus `--parent <N>` for a child issue.
- **Merging.** Pull requests are merged with merge commits only. Squash and rebase merges are disabled, and merged branches are deleted automatically.

## SDD Workflow

Every change follows the `label-suite-sdd` schema: nine planning and implementation artifacts whose order the OpenSpec CLI enforces. A documentation or tooling change may instead pass `--schema spec-driven` and use the four-artifact flow, the escape hatch the maintainer kept on 2026-11-04. The schema lives in `openspec/schemas/label-suite-sdd/`; the dispatch order, the rules per artifact and the two checkpoints live in `openspec/config.yaml`.

### Roles

| Stage | Artifact or action | Agent |
|-------|--------------------|-------|
| Plan | `system-analysis.md` | `sa` |
| Plan | `system-design.md`, `ui-design.md` (parallel) | `sd`, `ui-ux` |
| Plan | `api-contract.md` | `sd` |
| Plan | `proposal.md` | `planner` |
| Plan | `clarification.md` | the main agent, in the `clarify` skill's gate mode |
| Plan | `specs/**/spec.md`, `design.md`, `tasks.md` | `planner` |
| Plan | planning review | `design-reviewer` reviews, `planner` revises |
| Apply | implementation, group by group | `backend-developer`, `frontend-developer`, `dba`, `technical-writer` |
| Apply | code review | `code-reviewer` reviews, the implementing agent fixes |
| Apply | acceptance | `acceptance-verifier` |
| Archive | sync the main specs and move the change | `ops` |

Each role is defined in `.claude/agents/<role>.md`. The main agent dispatches; it does not write planning artifacts itself, with `clarification.md` the one exception, and it does not change project code.

**The SDD roles share one issue and one branch.** They all serve a single change and are dispatched in the order the schema enforces; only `system-design` and `ui-design` run at the same time, and they write different files. Do not give an SDD role its own worktree or its own issue. The separate-worktree, one-issue-each rule that `CLAUDE.md` states for parallel subagents is about splitting unrelated issues across agents, and does not apply here.

### The two checkpoints

Only two steps wait for the maintainer:

1. **After `clarification.md`.** Items that need the maintainer's decision (Q) are asked one at a time. Clear defects (P) go straight back to the agent that wrote the artifact; those are not asked.
2. **After acceptance.** `acceptance-verifier` writes `acceptance.md`, including manual acceptance steps - the commands to start the app, the URLs, which role to sign in as, which screens to open and what to expect. The maintainer verifies by hand and only then runs `/opsx:archive`.

Everything else - revising clear defects, the planning review, the code review, the commits between stages - runs without asking.

**A fault is not a checkpoint, and a fault still stops.** An ambiguous task description, a spec problem found during implementation, work outside the scope of `tasks.md`, or a failing command all stop the run. They mean the plan was wrong, and pushing through writes the wrong code.

### What `/sdd` authorizes

`.claude/commands/sdd.md` is this project's own command. Running `/sdd <request>` is a maintainer request that authorizes **both planning and implementation** for that one change: the agent runs the plan stage, stops at checkpoint one, continues into apply after the maintainer answers, and stops at checkpoint two.

The authorization lives in the command, not in `openspec/config.yaml`. `.claude/skills/openspec-propose/SKILL.md` states that project context cannot grant authorization or move the planning boundary, and `openspec update` overwrites that skill, so neither file is a place to put it. `openspec update` does not touch `.claude/commands/sdd.md`; it only rewrites or removes the `opsx/` command files it generates itself.

The authorization is per change and does not carry over. It covers the artifacts and the code that `tasks.md` lists, and nothing else:

- It does not authorize changing `docs/specs/` requirements. A decision that changes a requirement goes through `spec-writing` first, and the maintainer owns those pages.
- It does not authorize `docs/specs/00-prd.mdx` or `design/prototype/`. An interface change has its own gate, and it sits before Ready, not inside a run: see the Ready gate above.
- It does not authorize merging, releasing, or closing an issue.
- It does not lift any Hard Rule. Issue first still applies: no `/sdd` run starts without an open issue listing the work.

Running `/opsx:propose` on its own still authorizes planning only, as that skill requires.

## Commits

Full rules: [docs/development/commit-and-release.md](docs/development/commit-and-release.md). The essentials:

- English [Conventional Commits](https://www.conventionalcommits.org/): `<type>: <imperative subject, ≤ 72 chars> (#<issue>)`.
- Types: `feat` · `fix` · `docs` · `refactor` · `test` · `chore` · `ci` · `perf` · `build`.
- A body is always present. Each bullet starts with a bold verb (`**Add**`, `**Fix**`, `**Remove**`, `**Update**`, `**Refactor**`) and explains why.
- One purpose per commit.
- AI-assisted commits end with one `Co-Authored-By` trailer naming the model, and no other AI trailers. Claude Code uses its default trailer (configured in `.claude/settings.json`). Codex uses:

  ```text
  Co-Authored-By: Codex <noreply@openai.com>
  ```

## Pull Requests

- **One purpose per PR.** If the purpose cannot be stated in one sentence without "and" or "also", split it.
- **Title:** `<type>: <中文描述>`, using a commit type from the list above.
- **Body:** fill in [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md), and include `Closes #N`.

## Language Rules

| Artifact | Language |
|----------|----------|
| Code, comments, commit messages, API contracts, `AGENTS.md`, `CLAUDE.md` | English only (except as the `design/prototype/` row below allows) |
| `docs/` | Traditional Chinese allowed |
| Comments in `design/prototype/` | **Exception to the first row.** Traditional Chinese allowed (maintainer's ruling, 2026-11-12). Those comments mostly say which spec clause or which ruling a line implements, and the clauses themselves are in Chinese, so translating them only adds a second translation to check back against. Code and identifiers in those files stay English, by the first row. The on-screen copy is the screen's own content, in whichever language the screen shows it, and this table does not govern it. |
| `openspec/` artifacts (proposals, designs, tasks, spec deltas) | Traditional Chinese; OpenSpec structural headings (`## ADDED Requirements`, `### Requirement:`, `#### Scenario:`) and the `SHALL` / `MUST` keywords stay in English |
| Issues and PRs opened by an agent | Traditional Chinese for the body and the descriptive part of the title. The structural head (`[Bug]`, `feat:`), label names, code identifiers, file paths, commands, and verbatim error output stay in English |
| Replies to the maintainer | Traditional Chinese |

## Required Behaviors

- After cloning, run `scripts/setup.sh` once. It enables the commit-msg hook, which checks every commit message against the rules in [Commits](#commits). The `commit-messages` CI job runs the same checker on every commit in a pull request.
- Read the relevant files before changing them.
- Ask the maintainer about any decision that is theirs to make; do not proceed on an assumed default.
- If a tool call fails twice, report the exact error before trying again.
- Remove debug `print` / `console.log` before finishing.

## Agent Rules Index

The rules themselves live in this file. The documents below explain one area each — why a rule exists, worked examples, and how each is checked — and record, source clause by source clause, which parts of the reference projects were adopted, rewritten, rejected, or are still to be adopted. They share one shape, so read any of them the same way. Where a document and this file disagree, this file wins; report the discrepancy to the maintainer.

This repository has no `.claude/rules/` canon and will not get one (decided in #53). Another project's rule files are reference material only: they carry no authority here unless this file adopts them.

| Area | Document | Issue |
|------|----------|-------|
| Cross-cutting — search first, dependency direction, smallest change, no excessive abstraction, conflicts, locked scope, loud failure | [docs/development/agent-rules.md](docs/development/agent-rules.md) | #105 |
| Backend layering, database, background work | [docs/development/backend-agent-rules.md](docs/development/backend-agent-rules.md) | #106 |
| Authorization, answer isolation, config-driven boundaries | [docs/development/security-agent-rules.md](docs/development/security-agent-rules.md) | #107 |
| API contract sync, single frontend client | [docs/development/api-agent-rules.md](docs/development/api-agent-rules.md) | #108 |
| Frontend dependency direction, type safety, shared UI | [docs/development/frontend-agent-rules.md](docs/development/frontend-agent-rules.md) | #109 |
| Test layers, dual-database verification, delivery evidence | [docs/development/testing-agent-rules.md](docs/development/testing-agent-rules.md) | #110 |

All six documents now exist, but most of their rules are not being checked: `backend/`, `frontend/` and `e2e/` do not exist yet, so most of the checks those documents describe are marked as not built. The rest are marked as manual review, which means a person or an independent reviewer does them, not a tool. Read "not built" as literal, and do not report a check as passing when the check has not been built.

Two rules are worth stating here because they are reversals of what the reference projects say:

- **Conflicts are not yours to settle.** Follow this repository's settled decisions (`docs/specs/` decision sections, the ADR effect table in [docs/development/architecture.md](docs/development/architecture.md), this file). Where none covers the conflict, report it to the maintainer and stop. Never pick a side because one option is newer or easier to test.
- **Scope, once locked, is not yours to shrink.** After an issue or spec has committed to an acceptance item, do not drop it for being unnecessary. Take it back to that issue or spec; never park a deferred requirement in a code comment.

Size is judged by purpose, not by counting. This repository sets no file-count or diff-line ceiling for a pull request — see [Pull Requests](#pull-requests).

Technical baselines (stack choices, layering, ADR status) are in [docs/development/architecture.md](docs/development/architecture.md), and the pull-request categories are in [docs/development/spec-migration.md](docs/development/spec-migration.md).

How a rule gets triggered — which agent or Git event fires it, which shared checker it calls, and whether it blocks or only warns — is in [docs/development/agent-hook-contract.md](docs/development/agent-hook-contract.md), together with an event-by-event comparison of what Claude Code and Codex each support. That document is a contract, not a second rule canon, and it adds no rules. No agent hook is wired yet: `.claude/settings.json` carries only the attribution setting, there is no `.codex/hooks.json`, and the only hook checker that runs today is `scripts/check-commit-msg.sh` through `scripts/git-hooks/commit-msg`. Claude's hook configuration, events and exit codes do not carry over to Codex; that document lists the gaps instead of claiming they do.

## Review Guidelines

When reviewing, keep the review narrow, actionable, and tied to the requested scope:

- Prioritize correctness, security, test-set leakage, type safety, regression risk, and missing tests.
- Report only issues supported by the changed code, the surrounding code, failing checks, or the rules in this file.
- Do not expand into unrelated refactors, style preferences, speculative edge cases, or broad redesigns unless they cause a concrete bug or rule violation.
- Treat unchanged code as context. Mention it only when the PR makes its risk worse.
- Report at most 5 findings, but always report every Critical and High finding in full; summarize any further non-blocking issues as residual risk.
- Each finding names the file and line, the observable risk, and the smallest practical fix.
- If context is incomplete, say so once and review what is available.

Severity:

- **Critical** — must fix before merge: security vulnerabilities, auth or RBAC bypass, test-set answer leakage, data loss, destructive behavior, crashes, major correctness regressions, unreviewed breaking API or schema changes, hardcoded task logic, `allow_origins=["*"]`.
- **High** — fix before merge unless the maintainer accepts the risk: missing tests for changed behavior, clear regression scenarios, `any` in changed TypeScript, performance problems likely in normal use.
- **Medium** — non-blocking: incomplete docs for changed public behavior, weak non-critical error handling, maintainability issues likely to cause near-term bugs, edge-case test gaps.
- **Low** — non-blocking suggestion: naming, formatting, readability, small duplication, wording.

Only Critical and High findings block a merge. Every finding title starts with `[Critical]`, `[High]`, `[Medium][Non-blocking]`, or `[Low][Non-blocking]`. Non-blocking findings must not use words like "must fix" or "blocks merge". If there are no Critical or High findings, start the summary with `No blocking findings.`

## Codex-Specific Notes

- Give short progress updates, especially before edits and during long verification steps.
- Prefer `rg` for search and `apply_patch` for manual edits.
- `CLAUDE.md` holds Claude-only rules (context compaction, model selection, subagents); they do not apply to Codex.
- If a workflow step names a Claude slash command with no Codex equivalent, say so and follow the closest manual workflow.
