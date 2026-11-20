"""Alembic environment: async migrations for both database tiers (ADR-003 D7).

The database URL comes only from ``load_settings(DatabaseSettings)`` and
``create_engine``, the same code the API uses, so migrations run against the
database the service uses and never need app-only settings such as
``CORS_ALLOWED_ORIGINS`` (backend-agent-rules B10, design D9).

A caller (the test suite) may pass an open synchronous connection in
``config.attributes["connection"]``; it is used as is and left to the caller to
commit and close.

``render_as_batch`` is always on: on PostgreSQL batch operations still emit
plain ``ALTER`` statements, and only SQLite rebuilds the table, so one migration
file serves both tiers.
"""

import asyncio
import importlib
import importlib.util
import pkgutil
from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection

import app.modules
from app.core.config import DatabaseSettings, load_settings
from app.core.db import Base, create_engine

config = context.config

if config.config_file_name is not None and config.attributes.get("configure_logging", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)


def import_module_models() -> None:
    """Import every ``app.modules.<module>.models`` so its tables join ``Base.metadata``.

    New modules are picked up without editing this file.
    """
    for module in pkgutil.iter_modules(app.modules.__path__, prefix=f"{app.modules.__name__}."):
        if not module.ispkg:
            continue
        models_name = f"{module.name}.models"
        if importlib.util.find_spec(models_name) is not None:
            importlib.import_module(models_name)


import_module_models()
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit the migration SQL to stdout without connecting (``--sql``)."""
    settings = load_settings(DatabaseSettings)
    context.configure(
        url=settings.async_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run the migrations over an open synchronous connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Build an engine from ``DatabaseSettings`` and run the migrations on it."""
    engine = create_engine(load_settings(DatabaseSettings))
    try:
        async with engine.connect() as connection:
            await connection.run_sync(do_run_migrations)
            await connection.commit()
    finally:
        await engine.dispose()


def run_migrations_online() -> None:
    """Run the migrations over the caller's connection or a new engine."""
    connection = config.attributes.get("connection")
    if connection is not None:
        do_run_migrations(connection)
    else:
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
