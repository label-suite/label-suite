"""The Celery application factory shared by the worker and the API (design D5, D6, D10).

``create_celery_app`` turns ``WorkerSettings`` into a configured ``Celery`` instance.
It imports no task and no business module (``app.core`` never depends on modules):
the worker's assembly point, ``app.worker``, hands the task modules in with
``include``.

The configuration:

- two queues, ``default`` for chores such as mail and ``scoring`` for scoring work;
  ``default`` is the default queue;
- JSON is the only serializer and the only accepted content type, so a pickled
  message is refused instead of executed;
- results expire after a day; publishing gives up quickly when Redis is unreachable
  (2-second socket timeouts, at most two publish retries), so a caller waits seconds,
  not minutes;
- ``task_always_eager`` follows ``CELERY_TASK_ALWAYS_EAGER`` (the Lite tier only) and
  eager errors never propagate to the caller;
- Celery never installs its own log handlers: the ``setup_logging`` signal runs
  ``configure_logging``, so worker records use the same one-line format as the API.
"""

from typing import Any

from celery import Celery, signals
from kombu import Queue

from app.core.config import WorkerSettings
from app.core.log_config import configure_logging

__all__ = ["QUEUE_DEFAULT", "QUEUE_SCORING", "LabelSuiteCelery", "create_celery_app", "settings_of"]

QUEUE_DEFAULT = "default"
"""The queue for chores (mail and other short background work); the default queue."""

QUEUE_SCORING = "scoring"
"""The queue for scoring work (architecture.mdx §非同步任務)."""

_APP_NAME = "label_suite"
_RESULT_EXPIRES_SECONDS = 86400
_SOCKET_TIMEOUT_SECONDS = 2
_LOGGING_RECEIVER_ID = "label-suite-configure-logging"


class LabelSuiteCelery(Celery):
    """A ``Celery`` app that keeps the settings it was built from.

    A task reads its process's settings through ``settings_of(self.app)``, so the API
    (eager or not) and the worker each decide with the settings they loaded.

    Args:
        settings: The settings the app was built from.
    """

    def __init__(self, settings: WorkerSettings) -> None:
        super().__init__(_APP_NAME, set_as_current=False)
        self.worker_settings = settings


def settings_of(app: Celery) -> WorkerSettings | None:
    """Return the settings ``app`` was built from, or ``None`` for any other Celery app."""
    return app.worker_settings if isinstance(app, LabelSuiteCelery) else None


def create_celery_app(settings: WorkerSettings) -> LabelSuiteCelery:
    """Build the Celery app for ``settings``.

    Args:
        settings: Supplies the broker and result backend (``REDIS_URL`` with
            databases 0 and 1), the eager switch and ``LOG_LEVEL``.

    Returns:
        A configured app with no task module included, holding ``settings``;
        building it opens no connection and does not make it the current app.

    Side effects:
        Connects one receiver to Celery's process-wide ``setup_logging`` signal that
        calls ``configure_logging(settings)``. A later call replaces that receiver,
        so the signal always configures logging from the most recent settings.
    """
    app = LabelSuiteCelery(settings)
    app.conf.update(
        broker_url=settings.broker_url(),
        result_backend=settings.result_backend_url(),
        task_queues=(Queue(QUEUE_DEFAULT), Queue(QUEUE_SCORING)),
        task_default_queue=QUEUE_DEFAULT,
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        result_accept_content=["json"],
        result_expires=_RESULT_EXPIRES_SECONDS,
        broker_transport_options={
            "socket_connect_timeout": _SOCKET_TIMEOUT_SECONDS,
            "socket_timeout": _SOCKET_TIMEOUT_SECONDS,
        },
        task_publish_retry_policy={
            "max_retries": 2,
            "interval_start": 0,
            "interval_step": 0.5,
            "interval_max": 1,
        },
        task_always_eager=settings.celery_task_always_eager,
        task_eager_propagates=False,
        worker_hijack_root_logger=False,
    )
    _connect_logging(settings)
    return app


def _connect_logging(settings: WorkerSettings) -> None:
    """Make Celery's ``setup_logging`` signal run ``configure_logging(settings)``."""

    def configure(**_: Any) -> None:
        configure_logging(settings)

    signals.setup_logging.disconnect(dispatch_uid=_LOGGING_RECEIVER_ID)
    signals.setup_logging.connect(configure, weak=False, dispatch_uid=_LOGGING_RECEIVER_ID)
