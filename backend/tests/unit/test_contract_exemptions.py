"""Every ignored import carries a reason and a source, and nothing silences stale ones.

B12; issue #563, clarification Q6, design D6. ``tomllib`` drops comments, so the
comment rule scans the file as text and needs ``ignore_imports`` to be a multi-line
array with one entry per line. Staleness is import-linter's own default
(``unmatched_ignore_imports_alerting = "error"``), kept alive by forbidding the key.
"""

import re
import tomllib
from pathlib import Path

import pytest

from tests.unit.import_tree import PYPROJECT, append, build_tree, run_lint_imports

CONTRACT_START = "[[tool.importlinter.contracts]]"
SOURCE = re.compile(r"#\d+|\b[A-Z]\d+\b")
ENTRY = "app.modules.health.router -> app.modules.health.service"


def has_reason_and_source(comment: str) -> bool:
    """Return whether a ``#`` comment line holds a source reference and some reason text."""
    if not comment.startswith("#") or not SOURCE.search(comment):
        return False
    reason = re.sub(r"[\s#()\[\]:;,.\-]", "", SOURCE.sub("", comment))
    return bool(reason)


def find_bad_exemptions(path: Path) -> list[str]:
    """Return one message per ignored import without a reason and source, or per silenced alert."""
    text = path.read_text()
    contracts = tomllib.loads(text).get("tool", {}).get("importlinter", {}).get("contracts", [])
    problems: list[str] = []
    for index, segment in enumerate(text.split(CONTRACT_START)[1:]):
        found = re.search(r'^name\s*=\s*"([^"]+)"', segment, re.MULTILINE)
        name = found.group(1) if found else "<unnamed>"
        if re.search(r"^unmatched_ignore_imports_alerting\s*=", segment, re.MULTILINE):
            problems.append(f"{name}: unmatched_ignore_imports_alerting must not be set")
        entry_problems, qualified = _entry_problems(name, segment.splitlines())
        problems.extend(entry_problems)
        actual = len(contracts[index].get("ignore_imports", [])) if index < len(contracts) else 0
        if not entry_problems and actual != qualified:
            problems.append(
                f"{name}: {actual} ignored imports but {qualified} carry a reason and a source; "
                "use one entry per line, each under its own comment"
            )
    return problems


def _entry_problems(name: str, lines: list[str]) -> tuple[list[str], int]:
    """Check the ``ignore_imports`` array of one contract, given as text lines.

    Returns the problems and the number of entry lines that carry a qualifying comment.
    """
    problems: list[str] = []
    qualified = 0
    inside = False
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not inside and stripped.startswith("ignore_imports"):
            body = stripped.split("=", 1)[1].strip()
            if body == "[":
                inside = True
            elif body != "[]":
                problems.append(f"{name}: ignore_imports must be a multi-line array, one per line")
        elif inside and stripped.startswith("]"):
            inside = False
        elif inside and stripped and not stripped.startswith("#"):
            if has_reason_and_source(lines[index - 1].strip()):
                qualified += 1
            else:
                problems.append(f"{name}: ignored import {stripped} needs a reason and a source")
    return problems, qualified


def config(tmp_path: Path, contract_body: str) -> Path:
    path = tmp_path / "pyproject.toml"
    path.write_text(
        f'{CONTRACT_START}\nname = "Sample contract"\ntype = "forbidden"\n'
        f'source_modules = ["app.a"]\nforbidden_modules = ["app.b"]\n{contract_body}'
    )
    return path


def test_ignored_import_without_a_comment_is_named(tmp_path: Path) -> None:
    path = config(tmp_path, f'ignore_imports = [\n    "{ENTRY}",\n]\n')

    problems = find_bad_exemptions(path)

    assert len(problems) == 1
    assert "Sample contract" in problems[0]
    assert ENTRY in problems[0]


def test_single_line_ignore_array_with_an_entry_is_named(tmp_path: Path) -> None:
    path = config(tmp_path, f'ignore_imports = ["{ENTRY}"]\n')

    problems = find_bad_exemptions(path)

    assert len(problems) == 1
    assert "Sample contract" in problems[0]


def test_comment_without_an_issue_or_rule_number_is_named(tmp_path: Path) -> None:
    body = f'ignore_imports = [\n    # needed for the health check\n    "{ENTRY}",\n]\n'

    problems = find_bad_exemptions(config(tmp_path, body))

    assert len(problems) == 1
    assert ENTRY in problems[0]


def test_single_quoted_ignored_import_without_a_comment_is_named(tmp_path: Path) -> None:
    path = config(tmp_path, "ignore_imports = [\n    'app.a -> app.b',\n]\n")

    problems = find_bad_exemptions(path)

    assert len(problems) == 1
    assert "Sample contract" in problems[0]


def test_comment_with_only_a_source_and_no_reason_is_named(tmp_path: Path) -> None:
    body = f'ignore_imports = [\n    # #1\n    "{ENTRY}",\n]\n'

    problems = find_bad_exemptions(config(tmp_path, body))

    assert len(problems) == 1
    assert ENTRY in problems[0]


def test_several_entries_on_one_line_are_named(tmp_path: Path) -> None:
    body = f'ignore_imports = [\n    # reason (#563)\n    "{ENTRY}", "app.a -> app.b",\n]\n'

    problems = find_bad_exemptions(config(tmp_path, body))

    assert len(problems) == 1
    assert "Sample contract" in problems[0]


@pytest.mark.parametrize("source", ["#563", "B12"])
def test_comment_with_an_issue_or_rule_number_passes(tmp_path: Path, source: str) -> None:
    body = (
        f'ignore_imports = [\n    # health may read its own service ({source})\n    "{ENTRY}",\n]\n'
    )

    assert find_bad_exemptions(config(tmp_path, body)) == []


@pytest.mark.parametrize("mode", ["warn", "none"])
def test_contract_that_silences_stale_ignores_is_named(tmp_path: Path, mode: str) -> None:
    path = config(tmp_path, f'unmatched_ignore_imports_alerting = "{mode}"\n')

    problems = find_bad_exemptions(path)

    assert len(problems) == 1
    assert "Sample contract" in problems[0]
    assert "unmatched_ignore_imports_alerting" in problems[0]


def test_real_configuration_has_no_ignored_import_and_passes() -> None:
    with PYPROJECT.open("rb") as handle:
        contracts = tomllib.load(handle)["tool"]["importlinter"]["contracts"]

    assert [c["name"] for c in contracts if "ignore_imports" in c] == []
    assert find_bad_exemptions(PYPROJECT) == []


def test_ignored_import_that_matches_nothing_fails_the_run(tmp_path: Path) -> None:
    build_tree(tmp_path)
    append(
        tmp_path,
        "pyproject.toml",
        '\n[[tool.importlinter.contracts]]\nname = "Stale ignore"\ntype = "forbidden"\n'
        'source_modules = ["app.core"]\nforbidden_modules = ["app.modules"]\n'
        "ignore_imports = [\n    # stale on purpose (#563)\n"
        '    "app.core.base -> app.modules.health.service",\n]',
    )

    result = run_lint_imports(tmp_path)

    assert result.returncode != 0
    assert "No matches for ignored import" in result.stdout
