"""Helpers for the database comment coverage check (issue #822, ADR-003 D7, B7).

Two layers share these pure functions:

* the metadata layer (``tests/unit/test_db_comments.py``) asks that every table and column
  of the shared ``Base.metadata`` has a non-empty comment;
* the PostgreSQL layer (``tests/integration/test_db_comments_postgres.py``) asks that the
  comments the database stores after ``alembic upgrade head`` equal the model's.

The comparison and the load guards are pure functions over ``MetaData`` so a negative
sample on an independent ``MetaData()`` proves they fail. The only database access is
``read_pg_comments``, which reads the system catalog and writes nothing.

The file has no ``test_`` prefix, so pytest does not collect it.
"""

import importlib
import importlib.util
import pkgutil
from collections.abc import Iterable
from dataclasses import dataclass, field

from sqlalchemy import MetaData, Table, text
from sqlalchemy.ext.asyncio import AsyncConnection
from sqlalchemy.orm import registry

import app.modules

LANDED_TABLES: frozenset[str] = frozenset(
    {
        "users",
        "account_session",
        "account_refresh_token",
        "admin_role_permission",
        "admin_role_permission_version",
    }
)
"""Tables that already exist; the loaded metadata must contain all of them (subset check)."""


@dataclass(frozen=True)
class PgComments:
    """The comments PostgreSQL stores for one table, as read from the system catalog.

    ``present`` tells "the table is not in the database" apart from "it has no comment".
    """

    present: bool
    table_comment: str | None
    columns: dict[str, str | None] = field(default_factory=dict)


def is_blank(comment: str | None) -> bool:
    """Return True when ``comment`` is ``None`` or only whitespace (counts as missing)."""
    return comment is None or comment.strip() == ""


def model_modules_on_disk() -> list[str]:
    """Return ``app.modules.<m>.models`` for every module package that has a models file."""
    found: list[str] = []
    for module in pkgutil.iter_modules(app.modules.__path__, prefix=f"{app.modules.__name__}."):
        if not module.ispkg:
            continue
        models_name = f"{module.name}.models"
        if importlib.util.find_spec(models_name) is not None:
            found.append(models_name)
    return found


def load_all_models() -> list[str]:
    """Import every ``app.modules.<m>.models`` so its tables join ``Base.metadata``.

    Uses the same discovery rule as ``alembic/env.py``, which cannot be imported outside
    an Alembic run. Importing twice is harmless.

    Returns:
        The imported module names.
    """
    names = model_modules_on_disk()
    for name in names:
        importlib.import_module(name)
    return names


def mapped_modules(orm_registry: registry) -> set[str]:
    """Return the module names of every mapped class in ``orm_registry``."""
    return {mapper.class_.__module__ for mapper in orm_registry.mappers}


def metadata_tables(metadata: MetaData) -> list[Table]:
    """Return the tables to check, derived only from ``metadata`` (never from the database)."""
    return list(metadata.sorted_tables)


def load_problems(
    metadata: MetaData,
    mapped: Iterable[str],
    model_modules: Iterable[str],
    landed: Iterable[str],
) -> list[str]:
    """Return why the loaded metadata cannot be trusted, one message per problem.

    Guards against a vacuous pass: an empty table set, a landed table that is missing, and a
    ``models.py`` module that registered no mapped class.
    """
    problems: list[str] = []
    names = {table.name for table in metadata.sorted_tables}
    if not names:
        problems.append("no tables were loaded: the models failed to load, nothing was checked")
    else:
        problems.extend(
            f"{name}: landed table is missing from the loaded metadata"
            for name in sorted(set(landed) - names)
        )
    registered = set(mapped)
    problems.extend(
        f"{module}: module has a models file but no mapped class"
        for module in model_modules
        if module not in registered
    )
    return problems


def missing_comments(metadata: MetaData) -> list[str]:
    """Return one message per table or column whose comment is missing or blank."""
    problems: list[str] = []
    for table in metadata_tables(metadata):
        if is_blank(table.comment):
            problems.append(f"{table.name}: table comment is missing")
        problems.extend(
            f"{table.name}.{column.name}: column comment is missing"
            for column in table.columns
            if is_blank(column.comment)
        )
    return problems


async def read_pg_comments(
    connection: AsyncConnection, tables: Iterable[Table]
) -> dict[str, PgComments]:
    """Read the stored table and column comments of ``tables`` from PostgreSQL.

    Read-only. Table names travel as bound parameters; ``to_regclass`` returns NULL for a
    table that does not exist instead of raising.

    Args:
        connection: An open connection to a PostgreSQL database.
        tables: The tables to look up, taken from the model metadata.

    Returns:
        ``{table name: PgComments}`` with one entry per requested table.
    """
    preparer = connection.dialect.identifier_preparer
    result: dict[str, PgComments] = {}
    for table in tables:
        qualified = preparer.format_table(table)
        header = (
            await connection.execute(
                text(
                    "SELECT to_regclass(CAST(:qualified AS text)) IS NOT NULL AS present, "
                    "obj_description(to_regclass(CAST(:qualified AS text)), 'pg_class') AS comment"
                ),
                {"qualified": qualified},
            )
        ).one()
        columns: dict[str, str | None] = {}
        if header.present:
            rows = await connection.execute(
                text(
                    "SELECT a.attname AS name, col_description(a.attrelid, a.attnum) AS comment "
                    "FROM pg_attribute a "
                    "WHERE a.attrelid = to_regclass(CAST(:qualified AS text)) "
                    "AND a.attnum > 0 AND NOT a.attisdropped"
                ),
                {"qualified": qualified},
            )
            columns = {row.name: row.comment for row in rows}
        result[table.name] = PgComments(
            present=bool(header.present), table_comment=header.comment, columns=columns
        )
    return result


def _compare(label: str, kind: str, model: str | None, stored: str | None) -> str | None:
    """Return the message for one comment pair, or None when it matches exactly."""
    if is_blank(model):
        return f"{label}: model comment is missing"
    if is_blank(stored):
        return f"{label}: {kind} comment is missing in the database"
    if model != stored:
        return f"{label}: {kind} comment differs (model={model!r}, database={stored!r})"
    return None


def comment_mismatches(metadata: MetaData, stored: dict[str, PgComments]) -> list[str]:
    """Compare model comments with the stored ones; return one message per violation.

    Comments must be exactly equal, trailing whitespace included. Only tables in
    ``metadata`` are checked, so ``alembic_version`` and other non-model tables are ignored.
    A model comment that is itself missing is reported without comparing content.
    """
    problems: list[str] = []
    for table in metadata_tables(metadata):
        entry = stored.get(table.name)
        if entry is None or not entry.present:
            problems.append(
                f"{table.name}: table not found in the database (migrations not applied?)"
            )
            continue
        found = [_compare(table.name, "table", table.comment, entry.table_comment)]
        for column in table.columns:
            label = f"{table.name}.{column.name}"
            if column.name not in entry.columns:
                found.append(f"{label}: column not found in the database")
            else:
                found.append(_compare(label, "column", column.comment, entry.columns[column.name]))
        problems.extend(message for message in found if message is not None)
    return problems
