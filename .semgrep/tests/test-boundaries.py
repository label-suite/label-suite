# Samples for .semgrep/test-boundaries.yml (testing-agent-rules T4, T6; issue #562).
# `semgrep --test .semgrep/` checks every annotated line below. These samples are
# synthetic code: they are never imported or run, and hold no answer data.
import sys

import httpx
import pytest
from fastapi import APIRouter

import app.main
import app.scripts.export_openapi
import app.scripts.export_openapi as eo
from app.core.config import Settings
from app.main import create_app
from app.scripts import export_openapi

router = APIRouter()


def fake(*args, **kwargs):
    return None


# --- label-suite-test-self-mock-string ---------------------------------------


def string_targets(monkeypatch, mocker, name, buffer):
    # ruleid: label-suite-test-self-mock-string
    monkeypatch.setattr("app.main.create_app", fake)
    # ruleid: label-suite-test-self-mock-string
    monkeypatch.setattr('app.main.x', 1)
    # ruleid: label-suite-test-self-mock-string
    monkeypatch.setattr(f"app.{name}.x", 1)
    # ruleid: label-suite-test-self-mock-string
    monkeypatch.delattr("app.main.x")
    # ruleid: label-suite-test-self-mock-string
    monkeypatch.setitem("app.main.x", "k", 1)
    # ruleid: label-suite-test-self-mock-string
    monkeypatch.delitem("app", "k")
    # ruleid: label-suite-test-self-mock-string
    monkeypatch.setattr(target="app.main.x", value=1)
    # ruleid: label-suite-test-self-mock-string
    monkeypatch.setattr(target=f"app.{name}.x", value=1)
    # ruleid: label-suite-test-self-mock-string
    mocker.patch("app.core.config.Settings")
    # ruleid: label-suite-test-self-mock-string
    mocker.patch.dict("app.core.config.TABLE", {})
    # ruleid: label-suite-test-self-mock-string
    mocker.patch.multiple("app.main", x=1)
    # ok: label-suite-test-self-mock-string
    monkeypatch.setattr("application.x", 1)
    # ok: label-suite-test-self-mock-string
    monkeypatch.setattr("sys.stderr", buffer)


# ruleid: label-suite-test-mock-objects
from unittest.mock import patch


# ruleid: label-suite-test-self-mock-string
@patch("app.core.config.Settings")
def decorated(settings):
    return settings


def with_patch():
    # ruleid: label-suite-test-self-mock-string
    with patch("app.core.config.Settings"):
        pass
    # ruleid: label-suite-test-self-mock-string
    patch("app.core.config.Settings")
    # ok: label-suite-test-self-mock-string, label-suite-test-self-mock-object
    patch("httpx.AsyncClient.send")
    # ok: label-suite-test-self-mock-string, label-suite-test-self-mock-object
    patch.object(httpx.AsyncClient, "send")


# --- label-suite-test-self-mock-object ---------------------------------------


def object_targets(monkeypatch, mocker, path, fake_send, buffer):
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(Settings, "model_config", {})
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(Settings.model_config, "x", 1)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(eo, "build", fake)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(app.main, "x", 1)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(app.main.create_app, "x", 1)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(create_app, "x", 1)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setitem(export_openapi.TABLE, "k", 1)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.delattr(Settings, "x")
    # ruleid: label-suite-test-self-mock-object
    mocker.patch.object(export_openapi, "build_document")
    # ruleid: label-suite-test-self-mock-object
    patch.multiple(Settings, x=1)
    # ruleid: label-suite-test-self-mock-object
    patch.object(Settings, "x")
    # ruleid: label-suite-test-self-mock-object
    pytest.MonkeyPatch().setattr(Settings, "x", 1)
    # ruleid: label-suite-test-self-mock-object
    setattr(Settings, "x", 1)
    with monkeypatch.context() as m:
        # ruleid: label-suite-test-self-mock-object
        m.setattr(Settings, "x", 1)
    # ok: label-suite-test-self-mock-object
    monkeypatch.setattr(sys, "stderr", buffer)
    # ok: label-suite-test-self-mock-object
    monkeypatch.setattr(httpx.AsyncClient, "send", fake_send)


def export_openapi_constants(monkeypatch, path):
    # ok: label-suite-test-self-mock-object
    monkeypatch.setattr(export_openapi, "DEFAULT_OUTPUT", path)
    # ok: label-suite-test-self-mock-object
    monkeypatch.setattr(export_openapi, "DOCS_COPY_OUTPUT", path)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(export_openapi, "build_document", fake)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(eo, "DEFAULT_OUTPUT", path)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(app.scripts.export_openapi, "DOCS_COPY_OUTPUT", path)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(export_openapi, name="DEFAULT_OUTPUT", value=path)


def harness_app_fixture(monkeypatch, app):
    # The fixture named app is read as the app package (N4); the safe direction.
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(app.router, "routes", [])


# --- label-suite-test-dependency-overrides -----------------------------------


def dependency_overrides(application, client, get_session, fake_session, monkeypatch, mocker):
    # ruleid: label-suite-test-dependency-overrides
    application.dependency_overrides[get_session] = fake_session
    # ruleid: label-suite-test-dependency-overrides
    client.app.dependency_overrides.update({})
    # ruleid: label-suite-test-dependency-overrides
    application.dependency_overrides.setdefault(get_session, fake_session)
    # ruleid: label-suite-test-dependency-overrides
    application.dependency_overrides.pop(get_session)
    # ruleid: label-suite-test-dependency-overrides
    application.dependency_overrides.popitem()
    # ruleid: label-suite-test-dependency-overrides
    application.dependency_overrides.clear()
    # ruleid: label-suite-test-dependency-overrides
    application.dependency_overrides = {}
    # ruleid: label-suite-test-dependency-overrides
    del application.dependency_overrides[get_session]
    # ruleid: label-suite-test-dependency-overrides
    application.dependency_overrides |= {get_session: fake_session}
    # ruleid: label-suite-test-dependency-overrides
    monkeypatch.setitem(application.dependency_overrides, get_session, fake_session)
    # ruleid: label-suite-test-dependency-overrides
    patch.dict(application.dependency_overrides, {get_session: fake_session})
    with monkeypatch.context() as m:
        # ruleid: label-suite-test-dependency-overrides
        m.setitem(application.dependency_overrides, get_session, fake_session)
    # ruleid: label-suite-test-dependency-overrides
    mocker.patch.dict(application.dependency_overrides, {get_session: fake_session})
    # ok: label-suite-test-dependency-overrides
    current = application.dependency_overrides
    return current


# --- label-suite-test-mock-objects -------------------------------------------

# ruleid: label-suite-test-mock-objects
import unittest.mock

# ruleid: label-suite-test-mock-objects
from unittest import mock

# ruleid: label-suite-test-mock-objects
from unittest.mock import AsyncMock, MagicMock

# ruleid: label-suite-test-mock-objects
from unittest.mock import MagicMock as MM


def mock_objects(mocker):
    # ruleid: label-suite-test-mock-objects
    session = MagicMock()
    # ruleid: label-suite-test-mock-objects
    send = AsyncMock(return_value=None)
    # ruleid: label-suite-test-mock-objects
    plain = mock.Mock()
    # ruleid: label-suite-test-mock-objects
    spec = mock.create_autospec(Settings)
    # ruleid: label-suite-test-mock-objects
    full = unittest.mock.MagicMock()
    # ruleid: label-suite-test-mock-objects
    other = mocker.MagicMock()
    return session, send, plain, spec, full, other



def bare_mock_names(Mock, create_autospec):
    # A name imported from unittest.mock resolves to unittest.mock.Mock and is
    # caught by the $X.Mock(...) form as well, so local names are used here to
    # prove the bare Mock(...) and create_autospec(...) forms on their own.
    # ruleid: label-suite-test-mock-objects
    bare = Mock()
    # ruleid: label-suite-test-mock-objects
    bare_spec = create_autospec(Settings)
    return bare, bare_spec

# --- label-suite-test-own-app-factory ----------------------------------------


def own_app_factory(settings, probe_router):
    import fastapi
    import starlette.applications
    from fastapi import FastAPI
    from starlette.applications import Starlette

    # ruleid: label-suite-test-own-app-factory
    first = FastAPI(title="test")
    # ruleid: label-suite-test-own-app-factory
    second = fastapi.FastAPI()
    # ruleid: label-suite-test-own-app-factory
    third = Starlette()
    # ruleid: label-suite-test-own-app-factory
    fourth = starlette.applications.Starlette()
    # ok: label-suite-test-own-app-factory
    application = create_app(settings)
    # ok: label-suite-test-own-app-factory
    application.include_router(probe_router)
    return first, second, third, fourth, application


# --- not blocked: process environment and HTTP PATCH routes -------------------


def process_environment(monkeypatch, tmp_path):
    # ok: label-suite-test-self-mock-string
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    # ok: label-suite-test-self-mock-string
    monkeypatch.delenv("DATABASE_URL", raising=False)
    # ok: label-suite-test-self-mock-object
    monkeypatch.chdir(tmp_path)


# ok: label-suite-test-self-mock-string
@router.patch("/items")
def update_item():
    return None


# --- exemptions ----------------------------------------------------------------


def exemptions(monkeypatch, application, get_session):
    # ok: label-suite-test-self-mock-object
    monkeypatch.setattr(Settings, "x", 1)  # nosemgrep: label-suite-test-self-mock-object -- T4 sample reason
    # ok: label-suite-test-self-mock-object
    # nosemgrep: label-suite-test-self-mock-object -- T4 sample reason
    monkeypatch.setattr(Settings, "y", 1)
    # ruleid: label-suite-test-self-mock-object
    monkeypatch.setattr(Settings, "z", 1)  # nosemgrep: label-suite-test-dependency-overrides -- T4 wrong id


# --- known gaps (N5) -------------------------------------------------------------
# The three lines below slip past the rules: Semgrep tracks no name across
# statements. They carry no annotation on purpose. Should a future Semgrep
# release start to match one, the sample check reports it as an incorrect line,
# and that line then gets a should-match annotation.


def known_gaps(monkeypatch, application, get_session, fake_session):
    target = export_openapi
    monkeypatch.setattr(target, "build_document", fake)
    dotted = "app." + "main.x"
    monkeypatch.setattr(dotted, 1)
    overrides = application.dependency_overrides
    overrides[get_session] = fake_session
