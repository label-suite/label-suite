"""Every Semgrep exemption marker under backend/tests/ names a rule and a reason (#562).

testing-agent-rules T4 and T6 let an integration test opt out of a test-boundary rule
only with a marker that names the rule id and cites T4 or T6 (clarification Q7). Semgrep
treats any case-insensitive "nosem" that starts a line or follows whitespace as a marker,
inside a comment or not (clarification N3), and a bare one silences every rule on its
line. So each such occurrence must be the one qualifying marker on its line.

This file is scanned like any other test file, so its own text never holds the marker
word after whitespace: samples are built by concatenation split inside the word.
"""

import re
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
TESTS_DIR = BACKEND_DIR / "tests"

DETECT = re.compile(r"(?i)(?:^|\s)nosem")
"""Where Semgrep sees a marker: the word at a line start or right after whitespace."""

_RULE_ID = r"label-suite-test-[a-z0-9-]+"
QUALIFIED = re.compile(
    rf"#\s+(?P<word>nosemgrep):\s*{_RULE_ID}(?:\s*,\s*{_RULE_ID})*\s+--\s+(?P<reason>.+)"
)
"""The qualifying marker; ``word`` must sit where ``DETECT`` found the marker."""

CITES_CLAUSE = re.compile(r"\bT[46]\b")
REQUIRED_FORMAT = "# no" + "semgrep: label-suite-test-<rule-id>[, ...] -- T4|T6 <reason>"


def find_bad_markers(root: Path) -> list[str]:
    """Return one ``path:line`` finding per non-qualifying marker line under ``root``.

    Every ``*.py`` below ``root`` is read, skipping ``__pycache__``. Paths in the
    findings are relative to ``root``'s parent, so ``backend/tests`` gives
    ``tests/...``.
    """
    findings: list[str] = []
    for path in sorted(root.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        relative = path.relative_to(root.parent).as_posix()
        lines = path.read_text(encoding="utf-8").splitlines()
        for number, line in enumerate(lines, start=1):
            if DETECT.search(line) and not _qualifies(line):
                findings.append(f"{relative}:{number}: {line.strip()!r}; use {REQUIRED_FORMAT}")
    return findings


def _qualifies(line: str) -> bool:
    """Tell whether the line's only marker is a qualifying one."""
    markers = list(DETECT.finditer(line))
    if len(markers) != 1:
        return False
    word_start = markers[0].end() - len("nosem")
    return any(
        match.start("word") == word_start and CITES_CLAUSE.search(match.group("reason"))
        for match in QUALIFIED.finditer(line)
    )


NS = "no" + "sem"
"""The marker word's first five letters, kept out of this file's literal text."""

GOOD = "x = 1  # " + NS + "grep: label-suite-test-self-mock-object -- T4 fixture app is the seam"
GOOD_TWO_IDS = (
    "x = 1  # "
    + NS
    + "grep: label-suite-test-self-mock-object, label-suite-test-mock-objects -- T6 external"
)

BAD_LINES = {
    "bare": "x = 1  # " + NS + "grep",
    "short": "x = 1  # " + NS,
    "upper-case bare": "x = 1  # " + NS.upper() + "GREP",
    "id without reason": "x = 1  # " + NS + "grep: label-suite-test-self-mock-object",
    "reason without clause": (
        "x = 1  # " + NS + "grep: label-suite-test-self-mock-object -- needed here"
    ),
    "reason with T45 only": (
        "x = 1  # " + NS + "grep: label-suite-test-self-mock-object -- see T45 for this"
    ),
    "foreign rule id": "x = 1  # " + NS + "grep: python.lang.audit.eval -- T4 reason",
    "mid-comment": "x = 1  # see " + NS + "grep docs",
    "string without hash": 's = " ' + NS + '"',
    "string with hash": 's = "# ' + NS + 'grep"',
    "line start": NS + "grep",
    "second bare after qualifying": GOOD + " " + NS + "grep",
}


def _write(root: Path, relative: str, *lines: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(("import os", *lines)) + "\n", encoding="utf-8")


@pytest.mark.parametrize("line", BAD_LINES.values(), ids=BAD_LINES.keys())
def test_non_qualifying_marker_is_reported_with_path_and_line(tmp_path: Path, line: str) -> None:
    root = tmp_path / "tests"
    _write(root, "integration/test_sample.py", line)

    findings = find_bad_markers(root)

    assert len(findings) == 1
    assert findings[0].startswith("tests/integration/test_sample.py:2")
    assert REQUIRED_FORMAT in findings[0]


@pytest.mark.parametrize(
    "line",
    [GOOD, GOOD_TWO_IDS, "x = 1  #" + NS + "grep", "nosy = 'unrelated'"],
    ids=["qualifying", "two ids", "no whitespace before the word", "unrelated word"],
)
def test_qualifying_or_unseen_marker_is_not_reported(tmp_path: Path, line: str) -> None:
    root = tmp_path / "tests"
    _write(root, "integration/test_sample.py", line)

    assert find_bad_markers(root) == []


def test_every_marker_line_is_reported_once(tmp_path: Path) -> None:
    root = tmp_path / "tests"
    _write(root, "integration/test_sample.py", BAD_LINES["mid-comment"], GOOD, BAD_LINES["bare"])

    findings = find_bad_markers(root)

    assert [finding.split(": ", 1)[0] for finding in findings] == [
        "tests/integration/test_sample.py:2",
        "tests/integration/test_sample.py:4",
    ]


def test_nested_directories_are_walked_and_pycache_is_skipped(tmp_path: Path) -> None:
    root = tmp_path / "tests"
    _write(root, "unit/deep/er/test_nested.py", BAD_LINES["bare"])
    _write(root, "__pycache__/test_cached.py", BAD_LINES["bare"])
    _write(root, "integration/__pycache__/test_cached.py", BAD_LINES["bare"])

    findings = find_bad_markers(root)

    assert len(findings) == 1
    assert findings[0].startswith("tests/unit/deep/er/test_nested.py:2")


def test_backend_tests_hold_no_bad_marker() -> None:
    assert find_bad_markers(TESTS_DIR) == []
