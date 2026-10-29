# Changelog

All notable changes to Label Suite are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The release process is described in [docs/development/commit-and-release.md](docs/development/commit-and-release.md).

## [Unreleased]

### Added

- Apache-2.0 `LICENSE`, `NOTICE`, and `CITATION.cff` citation metadata
- Commit and release conventions in `docs/development/commit-and-release.md`

### Internal

- Agent rules for Claude Code and Codex in `AGENTS.md` and `CLAUDE.md`
- Commit message checker shared by the local commit-msg hook and the `commit-messages` CI job; enable the hook with `scripts/setup.sh`
