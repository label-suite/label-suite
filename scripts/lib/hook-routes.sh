#!/usr/bin/env bash
# The extension route table, shared by the checkers that need it (#111, D12).
#
# Sourced, not executed. It lives here because two checkers ask the same
# question — check-changed decides what to run, check-evidence decides what
# must have been run — and a second copy of the table would drift from the
# first the moment either changed.

# hook_route_for <repo-relative-path> — prints the route name, or nothing.
#
# The code routes are scoped by directory as well as extension. ruff, mypy,
# tsc and eslint take their configuration from backend/ and frontend/, and
# openspec/config.yaml runs them "when backend/ (frontend/) changes"; a .py
# or .ts elsewhere (e2e/, .semgrep/ fixtures, .notecraft/ components) is not
# part of either project, and handing it to their tools judges it against a
# configuration that was never written for it.
hook_route_for() {
  case "$1" in
    backend/*.py)                  printf 'py' ;;
    frontend/*.ts|frontend/*.tsx)  printf 'ts' ;;
    docs/*.mdx|docs/*.md|docs/*/*.mdx|docs/*/*.md|docs/*/*/*.mdx|docs/*/*/*.md) printf 'docs' ;;
    *)          printf '' ;;
  esac
}

# hook_route_enabled <route> <repo> — a layer counts as declared enabled when
# its directory exists. The docs route is always on: its checker is already in
# the repository.
hook_route_enabled() {
  case "$1" in
    py)   [ -d "$2/backend" ] ;;
    ts)   [ -d "$2/frontend" ] ;;
    docs) return 0 ;;
    *)    return 1 ;;
  esac
}

# The paths that never route, whatever their extension: generated clients,
# migrations, lockfiles and vendored trees.
HOOK_EXCLUDED_RE='^(frontend/src/api/generated/|backend/.*/alembic/versions/|backend/alembic/versions/)|(^|/)(vendor|node_modules)/|^(pnpm-lock\.yaml|uv\.lock)$'

# hook_route_outside_project <repo-relative-path> — succeeds for a file whose
# extension belongs to a code route but which sits outside that route's
# project directory, so the caller can say why it was not routed.
hook_route_outside_project() {
  case "$1" in
    backend/*.py|frontend/*.ts|frontend/*.tsx) return 1 ;;
    *.py|*.ts|*.tsx) return 0 ;;
    *) return 1 ;;
  esac
}
