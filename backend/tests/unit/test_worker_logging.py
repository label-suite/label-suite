"""Worker and HTTP-client log output (email-celery-worker design D10).

Spec ``server-logging``: "LOG_LEVEL 為 DEBUG 時也不輸出 HTTP 客戶端的標頭" (a real request
through ``httpx`` and ``httpcore`` to a local stand-in server) and "worker 的紀錄與 API 用同一個
格式" (the ``setup_logging`` signal is sent directly; no worker process is started).
"""

import io
import logging
import re
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import httpx
import pytest
from celery import signals

from app.core.celery_app import create_celery_app
from app.core.config import LogLevel, WorkerSettings
from app.core.log_config import configure_logging, is_repo_handler

LINE = re.compile(r"^timestamp=\S+Z level=INFO logger=\S+ traceId=- .*msg=.*$")


def _settings(tmp_path: Path, log_level: LogLevel = "INFO") -> WorkerSettings:
    return WorkerSettings(
        database_url=None,
        sqlite_path=tmp_path / "lite.db",
        redis_url="redis://redis:6379",
        resend_api_key=None,
        mail_from=None,
        celery_task_always_eager=False,
        log_level=log_level,
    )


class _Echo(BaseHTTPRequestHandler):
    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler's naming
        self.rfile.read(int(self.headers.get("Content-Length", "0")))
        self.send_response(200)
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"{}")

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        return


@pytest.fixture
def local_server() -> Iterator[str]:
    server = HTTPServer(("127.0.0.1", 0), _Echo)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}/emails"
    finally:
        server.shutdown()
        server.server_close()


def test_http_client_headers_and_body_stay_out_of_a_debug_log(
    tmp_path: Path, local_server: str
) -> None:
    buffer = io.StringIO()
    configure_logging(_settings(tmp_path, "DEBUG"), stream=buffer)

    with httpx.Client() as client:
        response = client.post(
            local_server,
            headers={"Authorization": "Bearer CANARY-key"},
            content=b"CANARY-body",
        )

    assert response.status_code == 200
    output = buffer.getvalue()
    assert "CANARY-key" not in output
    assert "CANARY-body" not in output
    assert not re.search(r"logger=(httpx|httpcore)\S* ", output)


def _send_setup_logging() -> None:
    signals.setup_logging.send(
        sender=None, loglevel=logging.INFO, logfile=None, format="", colorize=False
    )


def test_worker_records_use_the_key_value_format(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    create_celery_app(_settings(tmp_path))
    _send_setup_logging()

    logging.getLogger("celery.worker").info("worker ready")
    logging.getLogger("app.mail").info("outcome=sent")

    lines = [line for line in capsys.readouterr().err.splitlines() if line]
    assert len(lines) == 2
    assert all(LINE.match(line) for line in lines), lines
    assert "logger=celery.worker " in lines[0]
    assert "logger=app.mail " in lines[1]
    root = logging.getLogger()
    assert [h for h in root.handlers if is_repo_handler(h)]
    assert not [h for h in root.handlers if type(h).__module__.startswith("celery")]


def test_worker_exception_records_carry_only_the_type(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    create_celery_app(_settings(tmp_path))
    _send_setup_logging()

    try:
        raise ValueError("CANARY-exc")
    except ValueError:
        logging.getLogger("celery.worker").exception("task failed")

    output = capsys.readouterr().err
    lines = [line for line in output.splitlines() if line]
    assert len(lines) == 1
    assert "excType=builtins.ValueError" in lines[0]
    assert "CANARY-exc" not in output
    assert "Traceback" not in output
