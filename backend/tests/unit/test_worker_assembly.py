"""The worker's assembly point ``app.worker`` (design D1, D2).

Spec ``runtime-config`` "worker 只需要自己的設定" and "寄信服務只看有沒有設定" (the worker
half): importing ``app.worker`` reads ``WorkerSettings`` from the environment, so it is
run in a subprocess with a scrubbed environment instead of the test process.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
_SCRUBBED = (
    "CORS_ALLOWED_ORIGINS",
    "AUTH_SECRET",
    "DATABASE_URL",
    "SQLITE_PATH",
    "LOG_LEVEL",
    "REDIS_URL",
    "RESEND_API_KEY",
    "MAIL_FROM",
    "CELERY_TASK_ALWAYS_EAGER",
    "TEST_DATABASE_URL",
)
_PROBE = """
from app import worker
from app.core.celery_app import settings_of
app = worker.celery_app
print(sorted(app.conf.include))
print(app.conf.broker_url)
print(settings_of(app) is not None)
app.loader.import_default_modules()  # what the worker does at start-up
print("app.mail.tasks.send_mail" in app.tasks)
"""


def _import_worker(tmp_path: Path, **env: str) -> subprocess.CompletedProcess[str]:
    base = {k: v for k, v in os.environ.items() if k not in _SCRUBBED}
    return subprocess.run(  # noqa: S603 - fixed argv, no shell
        [sys.executable, "-c", _PROBE],
        cwd=tmp_path,
        env={**base, "PYTHONPATH": str(BACKEND_DIR), **env},
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.mark.parametrize("database_url", [None, "postgresql://user:pw@db/app"])
def test_the_worker_loads_without_api_only_settings(
    tmp_path: Path, database_url: str | None
) -> None:
    env = {"DATABASE_URL": database_url} if database_url else {}

    result = _import_worker(tmp_path, REDIS_URL="redis://redis:6379", **env)

    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [
        "['app.mail.tasks']",
        "redis://redis:6379/0",
        "True",
        "True",
    ]


def test_the_worker_refuses_a_mail_key_without_a_sender(tmp_path: Path) -> None:
    result = _import_worker(tmp_path, RESEND_API_KEY="re_CANARY-key")

    assert result.returncode != 0
    assert "MAIL_FROM" in result.stderr
    assert "re_CANARY-key" not in result.stderr


def test_the_worker_refuses_a_bad_log_level_without_echoing_it(tmp_path: Path) -> None:
    result = _import_worker(tmp_path, LOG_LEVEL="CANARY-verbose")

    assert result.returncode != 0
    assert "LOG_LEVEL" in result.stderr
    assert "CANARY-verbose" not in result.stderr
