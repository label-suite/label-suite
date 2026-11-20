#!/usr/bin/env bash
# setup.sh — one-time setup after cloning. Run from anywhere in the repository.
#
# Idempotent: running it twice is the same as running it once.
#
# It never replaces a core.hooksPath somebody chose on purpose. A value set on
# this repository is a conflict and stops the script, because enabling the
# hooks is the only thing setup does: returning 0 with them not installed
# would announce a success that did not happen. A value in the user or system
# configuration is reported instead of refused -- the repository-level setting
# overrides it here without touching it, and the developer only needs to know
# it is there for the day they unset the local one.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

WANT=scripts/git-hooks

# read_config <scope> -> the value, or empty. `git config --get` exits 1 when
# the key is unset, which under `set -e` would end the script; an unset key is
# the ordinary case here, not a failure.
read_config() {
  local value
  if value=$(git config "--$1" --get core.hooksPath 2>/dev/null); then
    printf '%s' "$value"
  fi
}

# One function, one call site: the Codex answer and the off switches are the
# part developers come back to, and they must not drift into two versions.
codex_trust_and_off_switch_notes() {
  cat <<NOTES

Codex skips repository hooks until the repository is trusted, and trust is
bound to a hash of the hook definitions, so every change to a hook silently
un-trusts them again -- nothing is printed when they are skipped. Run /hooks
in Codex to trust this repository, and run it again to re-trust after a hook
changes.

To turn the local hooks off again:
  git config --unset core.hooksPath          (git hooks)
  "disableAllHooks": true in .claude/settings.json   (Claude Code)
  hooks = false under [features] in .codex/config.toml   (Codex)

Turning them off locally changes nothing in CI: the same checks run there on
every pull request, and that is where the real gate is.
NOTES
}

LOCAL=$(read_config local)
GLOBAL=$(read_config global)
SYSTEM=$(read_config system)

if [ -n "$GLOBAL" ]; then
  echo "Note: core.hooksPath is also set in your global (user-level) configuration: $GLOBAL"
  echo "      This repository's own setting takes precedence here, and the global one is left alone."
fi
if [ -n "$SYSTEM" ]; then
  echo "Note: core.hooksPath is also set in the system configuration: $SYSTEM"
  echo "      This repository's own setting takes precedence here, and the system one is left alone."
fi

if [ "$LOCAL" = "$WANT" ]; then
  echo "Git hooks already enabled (core.hooksPath=$WANT): commit-msg and pre-commit."
elif [ -n "$LOCAL" ]; then
  echo "Refusing to change a core.hooksPath you set on purpose." >&2
  echo "  this repository currently has: $LOCAL" >&2
  echo "  setup wanted to set:           $WANT" >&2
  echo "Point it at $WANT yourself, or move your own hooks into that directory." >&2
  codex_trust_and_off_switch_notes >&2
  exit 1
else
  git config core.hooksPath "$WANT"
  echo "Git hooks enabled (core.hooksPath=$WANT): commit-msg and pre-commit."
fi

echo "The pre-commit hook needs Prettier and lint-staged: run 'pnpm install' if you have not."
codex_trust_and_off_switch_notes
