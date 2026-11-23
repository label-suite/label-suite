# Label Suite

Label Suite is a data labeling and quality evaluation platform for academic NLP research teams. Researchers assemble labeling tasks through configuration, and the team then runs trial labeling, formal labeling, review and data-quality analysis on the same platform. See the [product requirements document](docs/specs/00-prd.mdx) for scope, roles and modules.

## Documentation

All documentation lives in [`docs/`](docs/) and is served as a NoteCraft site:

```bash
pnpm install
pnpm docs:serve   # http://localhost:4330
```

Where to start:

- [`docs/specs/`](docs/specs/): business specifications, starting from the [PRD](docs/specs/00-prd.mdx).
- [`docs/development/architecture.mdx`](docs/development/architecture.mdx): technical baselines and layering.
- [`AGENTS.md`](AGENTS.md): the rules every contributor and coding agent follows.

## Repository layout

| Path                     | Contents                                                      |
| ------------------------ | ------------------------------------------------------------- |
| [`backend/`](backend/)   | FastAPI service, database migrations and the exported OpenAPI |
| [`frontend/`](frontend/) | React web app                                                 |
| [`docs/`](docs/)         | Specifications and development documentation (NoteCraft site) |
| [`design/`](design/)     | HTML prototype and the design system                          |
| [`openspec/`](openspec/) | Spec-driven change proposals and the main specs they update   |

## After cloning

Run these once:

```bash
scripts/setup.sh   # enables the commit-msg and pre-commit Git hooks
pnpm install       # installs Prettier, lint-staged, NoteCraft and OpenSpec
```

## License and citation

Released under the [Apache License 2.0](LICENSE). To cite Label Suite, use [`CITATION.cff`](CITATION.cff).
