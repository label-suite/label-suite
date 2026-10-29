# AGENTS.md

The single rule source for every coding agent working in this repository (Claude Code, Codex, and others). `CLAUDE.md` imports this file and adds only Claude-specific rules; nothing here is repeated there.

## Hard Rules

1. **Issue first** — no implementation starts without an open issue that lists the work.
2. **No commits to `main`** — branch first (`<type>/<short-description>`, lowercase, `-` separated, e.g. `docs/agent-rules`), then open a pull request.
3. **No `pip install` / `npm install`** — use `uv add` for Python and `pnpm add` for JavaScript so lockfiles stay in sync.
4. **No version bumps** — do not change the version in `CITATION.cff`, `backend/pyproject.toml`, or `frontend/package.json`. The only exception is the `chore(release)` commit described in [docs/commit-and-release.md](docs/commit-and-release.md).
5. **No hardcoded task logic** — task types are config-driven; adding one must not require changing core code.
6. **No test-set answer exposure** — anything an annotator can reach must never include ground-truth answers.
7. **No `any` in TypeScript**, and **no `allow_origins=["*"]`** in CORS — list origins explicitly.
8. **No hardcoded secrets** — API keys and tokens come from environment variables.
9. **No unconfirmed destructive commands** — `rm -rf`, `git reset --hard`, `git push --force`, `git branch -D` need the maintainer's explicit confirmation first.

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

- **Ready gate.** Only the maintainer moves an Epic to Ready. A child issue that maps to an item on its Epic's checklist counts as approved. New work outside any Epic checklist stays in Todo until the maintainer decides.
- **Dependencies.** Record them as GitHub issue dependencies (blocked-by), not only in the issue text. A child moves to Ready only when every issue blocking it is closed. The `blocked` label is reserved for external conditions, such as a directory that does not exist yet.
- **Claiming.** Before starting, move the card to In Progress and comment on the issue with the agent name and branch. Never pick up an issue that is already In Progress.
- **Card moves.** The agent doing the work moves its card: In Progress when claiming, In Review when the PR is open, Done after the PR is merged and the issue is closed. An Epic moves to In Progress when its first child starts and to Done when its last child is done.
- **Opening issues.** Pass everything in one command: `gh issue create --type <Type> --project "Label Suite"`, plus `--parent <N>` for a child issue.
- **Merging.** Pull requests are merged with merge commits only. Squash and rebase merges are disabled, and merged branches are deleted automatically.

## Commits

Full rules: [docs/commit-and-release.md](docs/commit-and-release.md). The essentials:

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
| Code, comments, commit messages, API contracts, `AGENTS.md`, `CLAUDE.md` | English only |
| `docs/` | Traditional Chinese allowed |
| Issues and PRs opened by an agent | Traditional Chinese for the body and the descriptive part of the title. The structural head (`[Bug]`, `feat:`), label names, code identifiers, file paths, commands, and verbatim error output stay in English |
| Replies to the maintainer | Traditional Chinese |

## Required Behaviors

- After cloning, run `scripts/setup.sh` once. It enables the commit-msg hook, which checks every commit message against the rules in [Commits](#commits). The `commit-messages` CI job runs the same checker on every commit in a pull request.
- Read the relevant files before changing them.
- Ask the maintainer about any decision that is theirs to make; do not proceed on an assumed default.
- If a tool call fails twice, report the exact error before trying again.
- Remove debug `print` / `console.log` before finishing.

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
