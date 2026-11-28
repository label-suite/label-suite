"""Shared helpers that build throwaway ``app`` trees and run ``lint-imports`` on them.

Used by the import-contract tests (B1, B12; issue #563, clarification Q9). The file has
no ``test_`` prefix, so pytest does not collect it. A sample tree holds every top-level
package that an entry contract lists in ``source_modules``, because ``lint-imports``
exits with ``Module 'app.scripts' does not exist.`` when one is missing.
"""

import os
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[2]
PYPROJECT = BACKEND_DIR / "pyproject.toml"
LINT_IMPORTS = Path(sys.executable).parent / "lint-imports"

MAIL = "Mail only through its entry"
OIDC = "OIDC only through its entry"
HTTP_CLIENT = "Outbound HTTP only through its entry"

INDEPENDENCE = "Modules do not import each other"
ROUTER_PROTECTED = "Only the assembly point imports routers"

ROUTER_MAIL = "Routers do not import the mail entry"
MAIL_MODULES = "Mail entry does not import modules"

# Third-party packages each entry owns; must equal that contract's forbidden_modules (design D4).
ENTRY_THIRD_PARTY: dict[str, set[str]] = {
    MAIL: {"resend", "smtplib", "aiosmtplib"},
    OIDC: {"authlib"},
    HTTP_CLIENT: {"httpx", "requests", "aiohttp", "urllib3"},
}
# Top-level packages registered as entries (design D3): app/oidc is the OIDC entry
# (login-auth-guard PL5, design D5) and app/mail the mail entry (email-celery-worker D9).
ENTRY_TOP_LEVEL_PACKAGES: set[str] = {"oidc", "mail"}

MODULE_FILES = {
    "__init__.py": "",
    "schemas.py": "from app.core.base import Base\n",
    "repository.py": "from app.core.base import Base\n",
    "service.py": (
        "from app.modules.{m}.repository import x\nfrom app.modules.{m}.schemas import y\n"
    ),
    "router.py": "from app.modules.{m}.service import x\nfrom app.modules.{m}.schemas import y\n",
}


def write(root: Path, relative: str, content: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def build_tree(root: Path, modules: tuple[str, ...] = ("health", "other")) -> None:
    """Write a clean ``app``: the modules, ``scripts``, ``mail``, ``main`` and ``worker``."""
    shutil.copy(PYPROJECT, root / "pyproject.toml")
    write(root, "app/__init__.py", "")
    write(root, "app/core/__init__.py", "")
    write(root, "app/core/base.py", "class Base: ...\n")
    write(root, "app/scripts/__init__.py", "")
    write(root, "app/mail/__init__.py", "")
    write(root, "app/worker.py", "")
    write(root, "app/modules/__init__.py", "")
    for module in modules:
        for name, content in MODULE_FILES.items():
            write(root, f"app/modules/{module}/{name}", content.format(m=module))
    imports = "".join(f"from app.modules.{m}.router import router as {m}_router\n" for m in modules)
    write(root, "app/main.py", imports)


def run_lint_imports(cwd: Path) -> subprocess.CompletedProcess[str]:
    env = {**os.environ, "PYTHONPATH": str(cwd)}
    return subprocess.run(  # noqa: S603 - fixed argv, no shell
        [str(LINT_IMPORTS)], cwd=cwd, env=env, capture_output=True, text=True, check=False
    )


def append(root: Path, relative: str, line: str) -> None:
    path = root / relative
    path.write_text(path.read_text() + line + "\n")


def load_contracts(path: Path = PYPROJECT) -> list[dict[str, Any]]:
    with path.open("rb") as handle:
        contracts: list[dict[str, Any]] = tomllib.load(handle)["tool"]["importlinter"]["contracts"]
    return contracts
