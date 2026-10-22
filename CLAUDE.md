@AGENTS.md

# Claude-Specific Rules

Everything in `AGENTS.md` applies. The rules below cover only what is specific to Claude Code.

## Model selection

Choose the model by how many files the task touches: 0–1 → Haiku · 2–9 → Sonnet · 10+ → Opus (latest of each tier). When a task is borderline, choose the larger model.

## Context management

- Compact at about 70% context use, or immediately when the session seems to have lost track of the task.
- At 95% or more, `/clear` and re-read the issue and the files involved from disk instead of relying on a summary.
- After `/compact` or `/clear`, re-read the issue being worked on before continuing.

## Subagents

- A subagent follows `AGENTS.md` like any other agent; pass it the issue number and its branch.
- Subagents working in parallel each get their own git worktree, and never share an issue.
- A subagent's report is not evidence. Check the branch, the commits, and the command output yourself before ticking an issue item.

## Attribution

`.claude/settings.json` sets `attribution.sessionUrl` to `false`, so commits keep only the default `Co-Authored-By` trailer and get no `Claude-Session` trailer. If a session starts outside this repository and does not load that file, leave the `Claude-Session` line out by hand.
