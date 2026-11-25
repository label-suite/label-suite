"""Size and complexity limits for the backend (backend-agent-rules B11, issue #561).

Two parts live here: ruff probes that pin the rule codes, the numeric limits and the
``per-file-ignores`` scope in ``pyproject.toml``, and the file-length checker. The ruff
probes copy the real ``pyproject.toml`` into ``tmp_path`` next to throwaway samples, so no
violating file ever lives in ``app/``.
"""

import json
import shutil
import subprocess
import sys
import tomllib
from collections.abc import Mapping
from pathlib import Path
from typing import Any, TypedDict

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
PYPROJECT = BACKEND_DIR / "pyproject.toml"
RUFF = Path(sys.executable).parent / "ruff"

SIZE_CODES = ("C901", "PLR0912", "PLR0915")
ALEMBIC_VERSIONS = "alembic/versions/**"

MAX_FILE_LINES = 400
SCANNED_DIRS = ("app", "tests", "alembic")
EXCLUDED_DIRS = ("alembic/versions",)


class Exemption(TypedDict):
    """One file allowed to exceed ``MAX_FILE_LINES``."""

    max: int
    issue: int
    reason: str


# An entry is also a ratchet: ``max`` replaces 400 as the ceiling for that file, and the
# entry fails as stale once the file is back within 400 lines, so it must then be removed.
# A new entry needs an issue number and a reason.
EXEMPTIONS: dict[str, Exemption] = {}


def count_lines(text: str) -> int:
    """Count the lines that count toward the limit, by plain text and without parsing.

    Blank lines and lines whose stripped text starts with ``#`` are excluded, wherever they
    sit, so a ``#`` line inside a docstring is excluded too. Every other line counts.
    """
    stripped = (line.strip() for line in text.splitlines())
    return sum(1 for line in stripped if line and not line.startswith("#"))


def scanned_files(root: Path) -> dict[str, Path]:
    """Map the relative posix path of every scanned ``.py`` file under ``root`` to its path."""
    found: dict[str, Path] = {}
    for directory in SCANNED_DIRS:
        for path in sorted((root / directory).rglob("*.py")):
            relative = path.relative_to(root).as_posix()
            if not any(relative.startswith(f"{excluded}/") for excluded in EXCLUDED_DIRS):
                found[relative] = path
    return found


def find_violations(root: Path, exemptions: Mapping[str, Exemption]) -> list[str]:
    """Return one message per file over its limit and per stale exemption under ``root``.

    Args:
        root: The backend directory, holding the scanned directories.
        exemptions: Files allowed to exceed ``MAX_FILE_LINES``, each with its own ceiling.

    Returns:
        Messages naming the relative path with the actual count and the limit, or telling
        the reader to remove an exemption that is no longer needed. Empty when all is well.
    """
    files = scanned_files(root)
    messages: list[str] = []
    for relative, path in files.items():
        count = count_lines(path.read_text())
        limit = exemptions[relative]["max"] if relative in exemptions else MAX_FILE_LINES
        if count > limit:
            messages.append(f"{relative}: {count} lines, limit {limit}")
        elif relative in exemptions and count <= MAX_FILE_LINES:
            messages.append(
                f"{relative}: exemption is stale ({count} lines, limit {MAX_FILE_LINES}); "
                "remove it from EXEMPTIONS"
            )
    messages.extend(
        f"{relative}: exemption points to a file that is not scanned; remove it from EXEMPTIONS"
        for relative in exemptions
        if relative not in files
    )
    return messages


def ruff_lint_config() -> dict[str, Any]:
    with PYPROJECT.open("rb") as handle:
        config: dict[str, Any] = tomllib.load(handle)["tool"]["ruff"]["lint"]
    return config


def statements_sample(count: int) -> str:
    body = "".join(f"    value_{i} = {i}\n" for i in range(count))
    return f"def many_statements() -> None:\n{body}"


def branches_sample(count: int) -> str:
    body = "".join(f"    if flag == {i}:\n        total += 1\n" for i in range(count))
    return f"def many_branches(flag: int) -> int:\n    total = 0\n{body}    return total\n"


def clean_sample() -> str:
    return "def add(left: int, right: int) -> int:\n    return left + right\n"


def wide_signature_sample() -> str:
    return (
        "def wide(a: int, b: int, c: int, d: int, e: int, f: int, g: int, h: int) -> int:\n"
        '    """Add eight numbers.\n\n'
        "    Args:\n"
        "        a: First.\n        b: Second.\n        c: Third.\n        d: Fourth.\n"
        "        e: Fifth.\n        f: Sixth.\n        g: Seventh.\n        h: Eighth.\n\n"
        "    Returns:\n        The sum.\n"
        '    """\n'
        "    return a + b + c + d + e + f + g + h\n"
    )


def ruff_codes(tmp_path: Path, relative: str, source: str) -> set[str]:
    """Lint one sample under a copy of the real config and return the rule codes found."""
    shutil.copy(PYPROJECT, tmp_path / "pyproject.toml")
    sample = tmp_path / relative
    sample.parent.mkdir(parents=True, exist_ok=True)
    sample.write_text(source)
    result = subprocess.run(  # noqa: S603 - fixed argv, no shell
        [str(RUFF), "check", "--no-cache", "--output-format", "json", relative],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    return {item["code"] for item in json.loads(result.stdout)}


def sized_samples() -> dict[str, str]:
    lint = ruff_lint_config()
    return {
        "PLR0915": statements_sample(lint["pylint"]["max-statements"] + 1),
        "PLR0912": branches_sample(lint["pylint"]["max-branches"] + 1),
        "C901": branches_sample(lint["mccabe"]["max-complexity"] + 1),
    }


def test_configured_limits_and_scope_match_the_agreed_values() -> None:
    lint = ruff_lint_config()
    ignores = lint["per-file-ignores"]

    assert set(SIZE_CODES) <= set(lint["select"])
    assert lint["mccabe"]["max-complexity"] == 10
    assert lint["pylint"]["max-statements"] == 30
    assert lint["pylint"]["max-branches"] == 10
    assert sorted(ignores[ALEMBIC_VERSIONS]) == sorted(SIZE_CODES)
    for pattern, codes in ignores.items():
        if pattern != ALEMBIC_VERSIONS:
            assert not [c for c in codes if any(size.startswith(c) for size in SIZE_CODES)], pattern


def test_clean_small_function_reports_no_size_code(tmp_path: Path) -> None:
    assert not ruff_codes(tmp_path, "app/clean.py", clean_sample()) & set(SIZE_CODES)


def test_function_over_the_statement_limit_is_reported(tmp_path: Path) -> None:
    codes = ruff_codes(tmp_path, "app/long.py", statements_sample(31))

    assert "PLR0915" in codes


def test_function_over_the_branch_limit_reports_branches_and_complexity(tmp_path: Path) -> None:
    codes = ruff_codes(tmp_path, "app/branchy.py", branches_sample(11))

    assert {"PLR0912", "C901"} <= codes


@pytest.mark.parametrize("code", ["PLR0915", "PLR0912", "C901"])
@pytest.mark.parametrize(
    ("directory", "reported"),
    [("app", True), ("tests", True), ("alembic", True), (ALEMBIC_VERSIONS[:-3], False)],
)
def test_size_limits_apply_by_directory(
    tmp_path: Path, code: str, directory: str, reported: bool
) -> None:
    source = sized_samples()[code]

    codes = ruff_codes(tmp_path, f"{directory}/sample.py", source)

    assert (code in codes) is reported


def test_many_parameters_with_a_full_docstring_report_no_pylint_code(tmp_path: Path) -> None:
    codes = ruff_codes(tmp_path, "app/wide.py", wide_signature_sample())

    assert not {code for code in codes if code.startswith("PLR")}


def code_lines(count: int) -> str:
    return "".join(f"value_{i} = {i}\n" for i in range(count))


def docstring(total: int, hashes: int) -> str:
    """Build a docstring of ``total`` lines, ``hashes`` of which start with ``#``."""
    inner = ["# heading"] * hashes + ["words"] * (total - 2 - hashes)
    return '"""\n' + "\n".join(inner) + '\n"""\n'


def violations_for(
    tmp_path: Path, relative: str, source: str, exempt: Mapping[str, Exemption] | None = None
) -> list[str]:
    target = tmp_path / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(source)
    return find_violations(tmp_path, exempt or {})


def test_file_over_the_limit_is_reported_with_path_count_and_limit(tmp_path: Path) -> None:
    messages = violations_for(tmp_path, "app/big.py", code_lines(401))

    assert len(messages) == 1
    assert all(part in messages[0] for part in ("app/big.py", "401", "400"))


def test_file_of_exactly_the_limit_passes(tmp_path: Path) -> None:
    assert violations_for(tmp_path, "app/edge.py", code_lines(400)) == []


def test_blank_and_hash_lines_are_not_counted_but_docstring_lines_are() -> None:
    text = code_lines(380) + docstring(30, 0) + "\n" * 50 + "# note\n" * 50

    assert count_lines(text) == 410


def test_docstring_lines_starting_with_a_hash_are_not_counted() -> None:
    text = code_lines(395) + docstring(10, 5)

    assert count_lines(text) == 400


def test_hash_lines_are_matched_after_stripping_whitespace() -> None:
    assert count_lines("    # indented\nvalue = 1\n   \n") == 1


def test_exempted_file_passes_up_to_its_ceiling_and_fails_above(tmp_path: Path) -> None:
    entry = Exemption(max=450, issue=1, reason="test")

    assert violations_for(tmp_path, "app/a.py", code_lines(430), {"app/a.py": entry}) == []
    messages = violations_for(tmp_path, "app/a.py", code_lines(451), {"app/a.py": entry})

    assert len(messages) == 1
    assert "451" in messages[0]
    assert "450" in messages[0]


def test_exemption_for_a_file_within_the_limit_is_reported_stale(tmp_path: Path) -> None:
    entry = Exemption(max=450, issue=1, reason="test")

    messages = violations_for(tmp_path, "app/a.py", code_lines(400), {"app/a.py": entry})

    assert len(messages) == 1
    assert "app/a.py" in messages[0]
    assert "remove" in messages[0]


def test_exemption_for_a_missing_file_is_reported_stale(tmp_path: Path) -> None:
    entry = Exemption(max=450, issue=1, reason="test")

    messages = violations_for(tmp_path, "app/other.py", "", {"app/gone.py": entry})

    assert len(messages) == 1
    assert "app/gone.py" in messages[0]


def test_alembic_versions_are_excluded_but_other_alembic_files_are_not(tmp_path: Path) -> None:
    assert violations_for(tmp_path, "alembic/versions/0001.py", code_lines(401)) == []
    messages = violations_for(tmp_path, "alembic/env.py", code_lines(401))

    assert len(messages) == 1
    assert "alembic/env.py" in messages[0]


def test_real_backend_is_within_the_limit_and_the_exemption_table_is_empty() -> None:
    assert find_violations(BACKEND_DIR, EXEMPTIONS) == []
    assert EXEMPTIONS == {}


def test_this_file_stays_within_the_limit() -> None:
    assert count_lines(Path(__file__).read_text()) <= MAX_FILE_LINES
