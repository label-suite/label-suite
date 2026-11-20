#!/usr/bin/env bash
# setup.sh — one-time setup after cloning. Run from anywhere in the repository.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath scripts/git-hooks
echo "Git hooks enabled (core.hooksPath=scripts/git-hooks): commit-msg and pre-commit."
echo "The pre-commit hook needs Prettier and lint-staged: run 'pnpm install' if you have not."
