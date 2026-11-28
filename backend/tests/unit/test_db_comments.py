"""Unit tests for the database comment coverage check, metadata layer (issue #822).

Covers spec ``database-migration``: every table and column of the shared metadata has a
non-empty comment, the check cannot pass vacuously because models were not loaded, and
the failure messages name ``<table>.<column>``. The negative samples build their own
``MetaData()`` so nothing is registered in the shared ``Base.metadata``.

These tests never connect to a database, so SQLite and PostgreSQL rounds run them alike.
"""

import pytest
from sqlalchemy import Column, Integer, MetaData, String, Table

from app.core.db import Base
from tests.support import db_comments
from tests.support.db_comments import (
    LANDED_TABLES,
    PgComments,
    comment_mismatches,
    load_all_models,
    load_problems,
    mapped_modules,
    metadata_tables,
    missing_comments,
    model_modules_on_disk,
)

# --- the real shared metadata ----------------------------------------------------------


def test_models_are_loaded_and_cover_the_landed_tables() -> None:
    load_all_models()

    problems = load_problems(
        Base.metadata, mapped_modules(Base.registry), model_modules_on_disk(), LANDED_TABLES
    )

    assert not problems, "\n".join(problems)
    assert LANDED_TABLES <= {table.name for table in Base.metadata.sorted_tables}


def test_every_models_module_registers_a_mapper() -> None:
    load_all_models()

    assert model_modules_on_disk(), "no app.modules.<m>.models file was found on disk"
    registered = mapped_modules(Base.registry)
    for module in model_modules_on_disk():
        assert module in registered, module


def test_every_table_and_column_has_a_comment() -> None:
    load_all_models()

    problems = missing_comments(Base.metadata)

    assert not problems, "\n".join(problems)


def test_loading_the_models_twice_is_harmless() -> None:
    load_all_models()
    before = {table.name for table in Base.metadata.sorted_tables}

    load_all_models()

    assert {table.name for table in Base.metadata.sorted_tables} == before


# --- negative samples on an independent MetaData ---------------------------------------


def _sample(
    *,
    table_comment: str | None = "Sample table.",
    column_comment: str | None = "Sample column.",
    other_comment: str | None = "Other column.",
) -> MetaData:
    metadata = MetaData()
    Table(
        "sample",
        metadata,
        Column("id", Integer, primary_key=True, comment=column_comment),
        Column("label", String(10), comment=other_comment),
        comment=table_comment,
    )
    return metadata


def test_a_fully_commented_sample_passes() -> None:
    assert missing_comments(_sample()) == []


def test_a_missing_column_comment_names_table_dot_column() -> None:
    problems = missing_comments(_sample(column_comment=None))

    assert problems == ["sample.id: column comment is missing"]


@pytest.mark.parametrize("blank", ["", "   ", "\t\n"])
def test_a_blank_column_comment_counts_as_missing(blank: str) -> None:
    problems = missing_comments(_sample(other_comment=blank))

    assert problems == ["sample.label: column comment is missing"]


def test_a_missing_table_comment_names_the_table() -> None:
    assert missing_comments(_sample(table_comment=None)) == ["sample: table comment is missing"]


def test_a_blank_table_comment_counts_as_missing() -> None:
    assert missing_comments(_sample(table_comment="  ")) == ["sample: table comment is missing"]


def test_all_violations_are_listed_at_once() -> None:
    problems = missing_comments(_sample(table_comment=None, column_comment=None, other_comment=" "))

    assert problems == [
        "sample: table comment is missing",
        "sample.id: column comment is missing",
        "sample.label: column comment is missing",
    ]


def test_a_junction_table_is_held_to_the_same_rule() -> None:
    metadata = MetaData()
    Table(
        "link",
        metadata,
        Column("left_id", Integer, primary_key=True),
        Column("right_id", Integer, primary_key=True),
    )

    problems = missing_comments(metadata)

    assert problems == [
        "link: table comment is missing",
        "link.left_id: column comment is missing",
        "link.right_id: column comment is missing",
    ]


def test_a_non_english_comment_is_not_rejected() -> None:
    assert missing_comments(_sample(column_comment="使用者識別碼")) == []


def test_the_sample_never_joins_the_shared_metadata() -> None:
    load_all_models()
    before = {table.name for table in Base.metadata.sorted_tables}

    missing_comments(_sample(column_comment=None))

    assert {table.name for table in Base.metadata.sorted_tables} == before
    assert "sample" not in before


def test_metadata_tables_returns_the_sorted_tables() -> None:
    metadata = _sample()

    assert [table.name for table in metadata_tables(metadata)] == ["sample"]


# --- the two load guards ---------------------------------------------------------------


def test_an_empty_metadata_fails_the_load_guard() -> None:
    problems = load_problems(MetaData(), set(), [], LANDED_TABLES)

    assert any("no tables" in problem for problem in problems)


def test_a_missing_landed_table_is_named() -> None:
    metadata = _sample()

    problems = load_problems(
        metadata, {"app.modules.x.models"}, ["app.modules.x.models"], {"sample", "ghost"}
    )

    assert problems == ["ghost: landed table is missing from the loaded metadata"]


def test_a_models_module_without_a_mapper_is_named() -> None:
    problems = load_problems(
        _sample(),
        {"app.modules.account.models"},
        ["app.modules.account.models", "app.modules.future.models"],
        {"sample"},
    )

    assert problems == ["app.modules.future.models: module has a models file but no mapped class"]


def test_the_landed_baseline_is_the_five_known_tables() -> None:
    assert LANDED_TABLES == {
        "users",
        "account_session",
        "account_refresh_token",
        "admin_role_permission",
        "admin_role_permission_version",
    }
    assert db_comments.is_blank(None)
    assert db_comments.is_blank("  ")
    assert not db_comments.is_blank("x")


# --- comparison with database comments (pure function, no database) --------------------


def _pg(
    *,
    present: bool = True,
    table: str | None = "Sample table.",
    columns: dict[str, str | None] | None = None,
) -> dict[str, PgComments]:
    cols: dict[str, str | None] = (
        {"id": "Sample column.", "label": "Other column."} if columns is None else columns
    )
    return {"sample": PgComments(present=present, table_comment=table, columns=cols)}


def test_identical_comments_have_no_mismatch() -> None:
    assert comment_mismatches(_sample(), _pg()) == []


def test_a_database_without_a_column_comment_is_reported() -> None:
    problems = comment_mismatches(_sample(), _pg(columns={"id": None, "label": "Other column."}))

    assert problems == ["sample.id: column comment is missing in the database"]


def test_a_differing_column_comment_shows_both_sides() -> None:
    problems = comment_mismatches(
        _sample(), _pg(columns={"id": "Changed.", "label": "Other column."})
    )

    assert problems == [
        "sample.id: column comment differs (model='Sample column.', database='Changed.')"
    ]


def test_a_trailing_space_difference_is_a_mismatch() -> None:
    problems = comment_mismatches(
        _sample(), _pg(columns={"id": "Sample column. ", "label": "Other column."})
    )

    assert len(problems) == 1
    assert problems[0].startswith("sample.id: column comment differs")


def test_a_differing_table_comment_shows_both_sides() -> None:
    problems = comment_mismatches(_sample(), _pg(table="Sample table. "))

    assert problems == [
        "sample: table comment differs (model='Sample table.', database='Sample table. ')"
    ]


def test_a_database_without_a_table_comment_is_reported() -> None:
    problems = comment_mismatches(_sample(), _pg(table=None))

    assert problems == ["sample: table comment is missing in the database"]


def test_a_table_absent_from_the_database_is_reported() -> None:
    problems = comment_mismatches(_sample(), _pg(present=False, table=None, columns={}))

    assert problems == ["sample: table not found in the database (migrations not applied?)"]


def test_a_column_absent_from_the_database_is_reported() -> None:
    problems = comment_mismatches(_sample(), _pg(columns={"id": "Sample column."}))

    assert problems == ["sample.label: column not found in the database"]


def test_a_table_the_model_does_not_know_is_never_checked() -> None:
    extra = {**_pg(), "alembic_version": PgComments(present=True, table_comment=None, columns={})}

    assert comment_mismatches(_sample(), extra) == []


def test_a_model_without_a_comment_is_reported_without_comparing_content() -> None:
    problems = comment_mismatches(_sample(column_comment=None), _pg())

    assert problems == ["sample.id: model comment is missing"]


def test_all_mismatches_are_listed_at_once() -> None:
    problems = comment_mismatches(
        _sample(),
        _pg(table="Different.", columns={"id": None, "label": None}),
    )

    assert len(problems) == 3
    assert problems[0].startswith("sample: table comment differs")
    assert problems[1].startswith("sample.id: ")
    assert problems[2].startswith("sample.label: ")
