"""Export the API's OpenAPI document to a file (design D2, api-agent-rules A4).

Run it from ``backend/`` with ``uv run python -m app.scripts.export_openapi
[--output PATH]``. It builds the app from fixed placeholder settings, never runs
the lifespan and never touches a database, so it needs no environment variable.
The output is deterministic (sorted keys, indent 2, trailing newline) so the
drift check can compare it byte for byte with the committed file.
"""

import argparse
import contextlib
import json
import os
import secrets
import sys
import tempfile
from collections.abc import Callable, Sequence
from pathlib import Path

from fastapi import FastAPI
from pydantic import SecretStr

from app.core.config import Settings
from app.core.openapi import ComponentNameCollisionError, OperationIdCollisionError
from app.main import create_app

__all__ = [
    "DEFAULT_OUTPUT",
    "DOCS_COPY_OUTPUT",
    "PLACEHOLDER_SETTINGS",
    "main",
    "render_openapi",
    "write_outputs",
]

DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "openapi.json"
"""``backend/openapi.json``, independent of the working directory."""

DOCS_COPY_OUTPUT = (
    Path(__file__).resolve().parents[3] / "docs" / "diagrams" / "architecture" / "api.openapi.json"
)
"""Docs-site copy, byte-identical to ``DEFAULT_OUTPUT``; not a second contract source."""

PLACEHOLDER_SETTINGS = Settings(
    cors_allowed_origins=["http://localhost"],
    cors_allow_credentials=True,
    api_docs_enabled=True,
    database_url=None,
    sqlite_path=Path("./data/label_suite.db"),
    # Random per run and never used to sign anything: it only keeps create_app from
    # reading or writing the Lite-tier secret file (system-design §AUTH_SECRET 的來源).
    auth_secret=SecretStr(secrets.token_urlsafe(48)),
)
"""Fixed settings for the export. Every field is set explicitly, so no
environment variable can change the document; none of them reaches the schema,
no database is opened because the lifespan never runs, and no secret file is
touched because ``auth_secret`` is set."""


def render_openapi(app: FastAPI) -> str:
    """Return ``app.openapi()`` as the exported JSON text.

    Raises:
        OperationIdCollisionError: When two operations share an operationId.
        ComponentNameCollisionError: When a renamed generic component collides.
        ValueError: When a route cannot be given an operationId.
    """
    return json.dumps(app.openapi(), sort_keys=True, indent=2, ensure_ascii=False) + "\n"


def write_outputs(text: str, targets: Sequence[Path]) -> None:
    """Write ``text`` to every target, all or nothing at the temp-write stage.

    Each target gets a temp file in its own directory (so ``os.replace`` stays on
    one filesystem). Only after every temp file is written are they moved over the
    targets. If any temp write fails, every temp file is removed, no target is
    touched and the ``OSError`` propagates. The replace step itself is not atomic
    across targets (design risk: a second failing replace leaves one updated).

    Raises:
        OSError: When a temp file cannot be written or a replace fails.
    """
    temps: list[tuple[Path, Path]] = []
    try:
        for target in targets:
            fd, name = tempfile.mkstemp(dir=target.parent, prefix=f".{target.name}.", suffix=".tmp")
            temp = Path(name)
            temps.append((temp, target))
            with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
                handle.write(text)
            temp.chmod(0o644)  # mkstemp creates 0600; keep the usual file mode
        while temps:
            temp, target = temps[0]
            os.replace(temp, target)
            temps.pop(0)
    finally:
        for temp, _ in temps:
            with contextlib.suppress(OSError):
                temp.unlink()


def main(
    argv: Sequence[str] | None = None,
    app_factory: Callable[[], FastAPI] = lambda: create_app(PLACEHOLDER_SETTINGS),
) -> int:
    """Write the OpenAPI document and return the process exit status.

    The document is rendered in full before any file is opened. Without
    ``--output`` it goes to ``DEFAULT_OUTPUT`` and ``DOCS_COPY_OUTPUT``; with
    ``--output PATH`` only to that path. A failure leaves existing files as they
    were and leaves no temp file.

    Args:
        argv: Command-line arguments without the program name; ``None`` reads
            ``sys.argv``.
        app_factory: Builds the app to export; tests pass their own.

    Returns:
        ``0`` on success; ``1`` when the app cannot produce a valid document,
        with the reason (e.g. the duplicate operationId and both routes,
        or the failed file write) written to stderr.
    """
    parser = argparse.ArgumentParser(description="Export the OpenAPI document.")
    parser.add_argument(
        "--output", type=Path, default=None, help="write only this path (no docs copy)"
    )
    args = parser.parse_args(argv)
    output: Path | None = args.output
    targets = [output] if output is not None else [DEFAULT_OUTPUT, DOCS_COPY_OUTPUT]

    try:
        text = render_openapi(app_factory())
    except (OperationIdCollisionError, ComponentNameCollisionError, ValueError) as exc:
        print(f"export_openapi: {exc}", file=sys.stderr)
        return 1

    try:
        write_outputs(text, targets)
    except OSError as exc:
        print(f"export_openapi: cannot write output: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
