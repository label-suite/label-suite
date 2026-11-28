"""The Celery worker's assembly point, the worker's counterpart of ``app.main``.

Run it with ``celery -A app.worker worker -Q default,scoring``. Importing this module
reads ``WorkerSettings`` from the environment (``load_settings``), so the worker needs
the database, queue, mail and ``LOG_LEVEL`` settings only, never
``CORS_ALLOWED_ORIGINS`` or ``AUTH_SECRET``; an invalid environment stops it with a
``ConfigError`` that names the variable. Task modules are listed in ``include`` as
strings, so ``app.core`` never imports a task. Like ``app.main`` it is checked by every
entry contract, so it never imports an entry's third-party package itself.
"""

from app.core.celery_app import LabelSuiteCelery, create_celery_app
from app.core.config import WorkerSettings, load_settings

__all__ = ["TASK_MODULES", "celery_app"]

TASK_MODULES = ["app.mail.tasks"]
"""Modules whose tasks this worker runs; a new task module is registered here."""

celery_app: LabelSuiteCelery = create_celery_app(load_settings(WorkerSettings))
celery_app.conf.include = TASK_MODULES
