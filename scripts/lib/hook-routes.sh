#!/usr/bin/env bash
# The extension route table, shared by the checkers that need it (#111, D12).
#
# Sourced, not executed. It lives here because two checkers ask the same
# question — check-changed decides what to run, check-evidence decides what
# must have been run — and a second copy of the table would drift from the
# first the moment either changed.

# hook_route_for <repo-relative-path> — prints the route name, or nothing.
hook_route_for() {
  case "$1" in
    *.py)       printf 'py' ;;
    *.ts|*.tsx) printf 'ts' ;;
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
