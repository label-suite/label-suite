# Commit and Release Conventions

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and are written in English.

```text
<type>: <imperative subject, ≤ 72 chars> (#<issue>)

- **<Verb>** <what changed, and why>
- **<Verb>** <...>

Co-Authored-By: <name> <email>
```

- **type**: `feat` · `fix` · `docs` · `refactor` · `test` · `chore` · `ci` · `perf` · `build`
- **Subject**: imperative mood ("add", not "added"), no trailing period. End with `(#N)` when the commit resolves or advances an issue.
- **Body**: always present. Each bullet starts with a bold verb — `**Add**`, `**Fix**`, `**Remove**`, `**Update**`, `**Refactor**` — and says why the change is needed, not only what changed.
- **One purpose per commit.** When several changes must land together (for example, splitting them would leave an unbuildable intermediate state), say so in the body.
- **AI assistance**: commits produced with an AI coding assistant carry a `Co-Authored-By` trailer naming the model. No other AI trailers are added.

Pull requests are merged with merge commits, so a PR title never becomes a commit subject.

## Releases

A release is cut at the end of each batch of work, as one dedicated commit:

```text
chore(release): label-suite X.Y.Z
```

That commit, and only that commit, updates every place that records the version:

| File | Field |
|------|-------|
| `CHANGELOG.md` | move `[Unreleased]` entries under `## [X.Y.Z] - YYYY-MM-DD` |
| `CITATION.cff` | `version`, `date-released` |
| `backend/pyproject.toml` | `version` |
| `frontend/package.json` | `version` |

### CHANGELOG entries

- Group entries under `Added` · `Changed` · `Fixed` · `Removed` · `Internal`.
- Under each version heading, add one `<!-- Highlight: ... -->` line summarising the release in a sentence.
- Breaking changes get a `> **Upgrade note:**` block directly below the heading, stating what users must do.

### Branches

`main` is currently the only long-lived branch. Feature branches are cut from and merged into `main`. Once a deployment environment exists, this changes to the three-branch model described in [Planned: three-branch flow](#planned-three-branch-flow).

### Release flow

Each version is tracked by a GitHub Milestone named after it (for example `v0.1.0`). Issues meant for that version are attached to the Milestone. The release starts only when every issue in the Milestone is closed.

1. **Release commit into `main`.** Open `chore/release-X.Y.Z` from `main`, make the release commit (all four version fields plus the CHANGELOG at once), and merge it into `main`.
2. **Tag.** Tag the merge commit on `main` `vX.Y.Z` and push the tag.
3. **GitHub Release and DOI.** Create a GitHub Release from the tag, using the version's CHANGELOG section as the notes. Zenodo archives the release and mints a DOI. Close the Milestone.

### Hotfixes

Cut the hotfix branch from `main`. It carries its own PATCH release commit, and is merged and tagged like any other release.

### Planned: three-branch flow

Not in use yet. It takes over from the single-`main` flow above once staging and production environments exist.

- **Branches.** Feature branches are cut from and merged into `dev`. `dev` is promoted to `release` for UAT, and `release` to `main` for production.
- **Release commit into `dev`.** The release commit is merged into `dev` before `dev` is promoted, because the image is built once on `release` and never rebuilt.
- **`dev` → `release`.** Promoting builds the image and deploys it to staging for UAT.
- **`release` → `main`.** After manual approval, the same image is deployed to production. Tag the merge commit on `main` `vX.Y.Z`, push the tag, and add a `vX.Y.Z` alias tag in GHCR to the same image digest. The GitHub Release and DOI step is unchanged.
- **Pre-release tags** such as `vX.Y.Z-rc.N` may be used for staging builds. They are optional.
- **Hotfixes** are cut from `main`; after merging and tagging, `main` is merged back into `release` and `dev`.

### What the version means

- **Until the tag exists, a version number is only reserved.** If UAT fails, the release can be abandoned and redone; nothing has shipped under that number.
- **`date-released` in `CITATION.cff` is the day the release commit is made**, not the day the tag is pushed.
- **Papers cite the version DOI**, which points at one exact release. The concept DOI, recorded in `CITATION.cff` once it exists, always resolves to the latest release and is not used for citations.

Versions follow SemVer: MAJOR for incompatible changes to task configuration or exported data formats, MINOR for new features, PATCH for fixes.
