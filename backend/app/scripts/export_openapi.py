"""Export the API's OpenAPI document to a file (design D2, api-agent-rules A4).

Run it from ``backend/`` with ``uv run python -m app.scripts.export_openapi
[--output PATH]``. It builds the app from fixed placeholder settings, never runs
the lifespan and never touches a database, so it needs no environment variable.
The output is deterministic (sorted keys, indent 2, trailing newline) so the
drift check can compare it byte for byte with the committed file.
"""

import argparse
import json
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

from fastapi import FastAPI

from app.core.config import Settings
from app.core.openapi import ComponentNameCollisionError, OperationIdCollisionError
from app.main import create_app

__all__ = ["DEFAULT_OUTPUT", "PLACEHOLDER_SETTINGS", "main", "render_openapi"]

DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "openapi.json"
"""``backend/openapi.json``, independent of the working directory."""

PLACEHOLDER_SETTINGS = Settings(
    cors_allowed_origins=["http://localhost"],
    cors_allow_credentials=True,
    database_url=None,
    sqlite_path=Path("./data/label_suite.db"),
)
"""Fixed settings for the export. Every field is set explicitly, so no
environment variable can change the document; none of them reaches the schema
and no database is opened because the lifespan never runs."""


def render_openapi(app: FastAPI) -> str:
    """Return ``app.openapi()`` as the exported JSON text.

    Raises:
        OperationIdCollisionError: When two operations share an operationId.
        ComponentNameCollisionError: When a renamed generic component collides.
        ValueError: When a route cannot be given an operationId.
    """
    return json.dumps(app.openapi(), sort_keys=True, indent=2, ensure_ascii=False) + "\n"


def main(
    argv: Sequence[str] | None = None,
    app_factory: Callable[[], FastAPI] = lambda: create_app(PLACEHOLDER_SETTINGS),
) -> int:
    """Write the OpenAPI document and return the process exit status.

    The document is rendered in full before the file is opened, so a failure
    leaves any existing output untouched and creates no new file.

    Args:
        argv: Command-line arguments without the program name; ``None`` reads
            ``sys.argv``.
        app_factory: Builds the app to export; tests pass their own.

    Returns:
        ``0`` on success; ``1`` when the app cannot produce a valid document,
        with the reason (e.g. the duplicate operationId and both routes)
        written to stderr.
    """
    parser = argparse.ArgumentParser(description="Export the OpenAPI document.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="output file path")
    args = parser.parse_args(argv)
    output: Path = args.output

    try:
        text = render_openapi(app_factory())
    except (OperationIdCollisionError, ComponentNameCollisionError, ValueError) as exc:
        print(f"export_openapi: {exc}", file=sys.stderr)
        return 1

    output.write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
