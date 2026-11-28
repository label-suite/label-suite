"""Unit tests for ``app.core.celery_app`` (email-celery-worker design D5, D6, D10).

Covers the Celery configuration ``create_celery_app`` builds and spec ``mail-delivery``
"非 JSON 編碼的工作被拒絕": the serializer settings allow JSON only, and kombu, decoding
with exactly those settings, refuses a pickle payload. Nothing is sent and no broker is
needed.
"""

import pickle
from pathlib import Path

import pytest
from celery import signals
from kombu.exceptions import ContentDisallowed
from kombu.serialization import loads, prepare_accept_content

from app.core.celery_app import QUEUE_DEFAULT, QUEUE_SCORING, create_celery_app
from app.core.config import WorkerSettings


def _settings(tmp_path: Path, **overrides: object) -> WorkerSettings:
    values: dict[str, object] = {
        "database_url": None,
        "sqlite_path": tmp_path / "lite.db",
        "redis_url": "redis://redis:6379",
        "resend_api_key": None,
        "mail_from": None,
        "celery_task_always_eager": False,
        "log_level": "INFO",
    }
    values.update(overrides)
    return WorkerSettings.model_validate(values)


def test_queues_are_default_and_scoring_with_default_as_the_default(tmp_path: Path) -> None:
    conf = create_celery_app(_settings(tmp_path)).conf

    assert (QUEUE_DEFAULT, QUEUE_SCORING) == ("default", "scoring")
    assert {queue.name for queue in conf.task_queues} == {"default", "scoring"}
    assert conf.task_default_queue == "default"


def test_broker_and_result_backend_come_from_redis_url(tmp_path: Path) -> None:
    conf = create_celery_app(_settings(tmp_path)).conf

    assert conf.broker_url == "redis://redis:6379/0"
    assert conf.result_backend == "redis://redis:6379/1"


def test_serialization_is_json_only(tmp_path: Path) -> None:
    conf = create_celery_app(_settings(tmp_path)).conf

    assert conf.task_serializer == "json"
    assert conf.result_serializer == "json"
    assert list(conf.accept_content) == ["json"]
    assert list(conf.result_accept_content) == ["json"]


def test_a_pickle_payload_is_refused_under_the_configured_accept_list(tmp_path: Path) -> None:
    conf = create_celery_app(_settings(tmp_path)).conf
    payload = pickle.dumps({"mail_id": "x"})

    with pytest.raises(ContentDisallowed):
        loads(
            payload,
            "application/x-python-serialize",
            "binary",
            accept=prepare_accept_content(conf.accept_content),
        )


def test_results_expire_after_a_day_and_publishing_fails_fast(tmp_path: Path) -> None:
    conf = create_celery_app(_settings(tmp_path)).conf

    assert conf.result_expires == 86400
    assert conf.broker_transport_options == {"socket_connect_timeout": 2, "socket_timeout": 2}
    assert conf.task_publish_retry_policy == {
        "max_retries": 2,
        "interval_start": 0,
        "interval_step": 0.5,
        "interval_max": 1,
    }


@pytest.mark.parametrize("eager", [True, False])
def test_eager_follows_the_setting_and_never_propagates(tmp_path: Path, eager: bool) -> None:
    conf = create_celery_app(_settings(tmp_path, celery_task_always_eager=eager)).conf

    assert conf.task_always_eager is eager
    assert conf.task_eager_propagates is False


def test_celery_does_not_take_over_the_root_logger(tmp_path: Path) -> None:
    conf = create_celery_app(_settings(tmp_path)).conf

    assert conf.worker_hijack_root_logger is False


def test_building_the_app_twice_leaves_one_logging_receiver(tmp_path: Path) -> None:
    before = len(signals.setup_logging.receivers or [])
    create_celery_app(_settings(tmp_path))
    create_celery_app(_settings(tmp_path))

    assert len(signals.setup_logging.receivers or []) <= before + 1
    assert signals.setup_logging.receivers


def test_the_app_includes_no_task_module(tmp_path: Path) -> None:
    app = create_celery_app(_settings(tmp_path))

    assert not app.conf.include
