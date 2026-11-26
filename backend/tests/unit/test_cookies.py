"""Unit tests for ``app.core.cookies.SessionCookies`` (login-auth-guard task 3.1).

The four cookies follow ``api-contract.md`` §共用約定: every one carries the ``__Host-``
prefix with ``Secure``, ``Path=/`` and no ``Domain``; only the CSRF cookie is readable by
scripts; all are ``SameSite=Lax``. ``SessionCookies`` is the only place in ``app/`` that
sets or deletes a cookie (security-agent-rules S2).
"""

import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from starlette.requests import HTTPConnection
from starlette.responses import Response

from app.core.cookies import (
    ACCESS_COOKIE,
    CSRF_COOKIE,
    OIDC_FLOW_COOKIE,
    OIDC_FLOW_MAX_AGE,
    REFRESH_COOKIE,
    SessionCookies,
)

APP_DIR = Path(__file__).resolve().parents[2] / "app"
NOW = datetime(2026, 11, 26, 8, 0, tzinfo=UTC)
ACCESS_VALUE = "access-value"
REFRESH_VALUE = "refresh-value"
CSRF_VALUE = "csrf-value"


def _parse(header: str) -> tuple[str, str, dict[str, str]]:
    first, *attributes = [part.strip() for part in header.split(";")]
    name, _, value = first.partition("=")
    parsed: dict[str, str] = {}
    for attribute in attributes:
        key, _, attr_value = attribute.partition("=")
        parsed[key.lower()] = attr_value
    return name, value, parsed


def _cookies(response: Response) -> dict[str, tuple[str, dict[str, str]]]:
    result: dict[str, tuple[str, dict[str, str]]] = {}
    for header in response.headers.getlist("set-cookie"):
        name, value, attributes = _parse(header)
        result[name] = (value, attributes)
    return result


def _set_session(expires_at: datetime) -> dict[str, tuple[str, dict[str, str]]]:
    response = Response()
    SessionCookies.set_session(
        response,
        access_value=ACCESS_VALUE,
        refresh_value=REFRESH_VALUE,
        csrf_value=CSRF_VALUE,
        expires_at=expires_at,
        now=NOW,
    )
    return _cookies(response)


def test_cookie_names_follow_the_contract() -> None:
    assert (ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE, OIDC_FLOW_COOKIE) == (
        "__Host-ls_at",
        "__Host-ls_rt",
        "__Host-ls_csrf",
        "__Host-ls_oidc",
    )


def test_set_session_writes_three_host_prefixed_cookies() -> None:
    cookies = _set_session(NOW + timedelta(days=7))

    assert set(cookies) == {ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE}
    assert cookies[ACCESS_COOKIE][0] == ACCESS_VALUE
    assert cookies[REFRESH_COOKIE][0] == REFRESH_VALUE
    assert cookies[CSRF_COOKIE][0] == CSRF_VALUE


@pytest.mark.parametrize("name", [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE])
def test_every_session_cookie_is_secure_root_path_lax_and_has_no_domain(name: str) -> None:
    _, attributes = _set_session(NOW + timedelta(days=7))[name]

    assert "secure" in attributes
    assert attributes["path"] == "/"
    assert attributes["samesite"].lower() == "lax"
    assert "domain" not in attributes


@pytest.mark.parametrize(
    ("name", "http_only"), [(ACCESS_COOKIE, True), (REFRESH_COOKIE, True), (CSRF_COOKIE, False)]
)
def test_only_the_csrf_cookie_is_readable_by_scripts(name: str, http_only: bool) -> None:
    _, attributes = _set_session(NOW + timedelta(days=7))[name]

    assert ("httponly" in attributes) is http_only


@pytest.mark.parametrize("name", [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE])
def test_session_cookies_live_until_the_refresh_token_expires(name: str) -> None:
    _, attributes = _set_session(NOW + timedelta(days=7, seconds=30))[name]

    assert attributes["max-age"] == str(7 * 24 * 3600 + 30)


def test_an_expiry_in_the_past_gives_max_age_zero() -> None:
    _, attributes = _set_session(NOW - timedelta(seconds=5))[ACCESS_COOKIE]

    assert attributes["max-age"] == "0"


def test_set_session_rejects_a_naive_expiry() -> None:
    with pytest.raises(ValueError, match="timezone"):
        _set_session(datetime(2026, 12, 1, 8, 0))


def test_oidc_flow_cookie_is_http_only_lax_and_lives_ten_minutes() -> None:
    response = Response()

    SessionCookies.set_oidc_flow(response, "flow-value")

    value, attributes = _cookies(response)[OIDC_FLOW_COOKIE]
    assert value == "flow-value"
    assert OIDC_FLOW_MAX_AGE == 600
    assert attributes["max-age"] == "600"
    assert "httponly" in attributes
    assert "secure" in attributes
    assert attributes["path"] == "/"
    assert attributes["samesite"].lower() == "lax"
    assert "domain" not in attributes


def test_clear_expires_the_three_session_cookies_with_the_same_attributes() -> None:
    response = Response()

    SessionCookies.clear(response)

    cookies = _cookies(response)
    assert set(cookies) == {ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE}
    for _, attributes in cookies.values():
        assert attributes["max-age"] == "0"
        assert "secure" in attributes
        assert attributes["path"] == "/"
        assert "domain" not in attributes


def test_clear_oidc_flow_expires_only_the_flow_cookie() -> None:
    response = Response()

    SessionCookies.clear_oidc_flow(response)

    cookies = _cookies(response)
    assert set(cookies) == {OIDC_FLOW_COOKIE}
    assert cookies[OIDC_FLOW_COOKIE][1]["max-age"] == "0"


def _connection(
    cookie_header: str | None, extra: list[tuple[bytes, bytes]] | None = None
) -> HTTPConnection:
    headers = list(extra or [])
    if cookie_header is not None:
        headers.append((b"cookie", cookie_header.encode()))
    return HTTPConnection({"type": "http", "headers": headers})


def test_readers_return_each_cookie() -> None:
    connection = _connection(
        f"{ACCESS_COOKIE}=a1; {REFRESH_COOKIE}=r1; {CSRF_COOKIE}=c1; {OIDC_FLOW_COOKIE}=o1"
    )

    assert SessionCookies.read_access(connection) == "a1"
    assert SessionCookies.read_refresh(connection) == "r1"
    assert SessionCookies.read_csrf(connection) == "c1"
    assert SessionCookies.read_oidc_flow(connection) == "o1"


def test_readers_return_none_when_the_cookie_is_absent() -> None:
    connection = _connection(None)

    assert SessionCookies.read_access(connection) is None
    assert SessionCookies.read_refresh(connection) is None
    assert SessionCookies.read_csrf(connection) is None
    assert SessionCookies.read_oidc_flow(connection) is None


def test_read_access_ignores_the_authorization_header_and_unprefixed_names() -> None:
    connection = _connection("ls_at=plain", [(b"authorization", b"Bearer abc")])

    assert SessionCookies.read_access(connection) is None


_COOKIE_WRITE = re.compile(r"\.(set_cookie|delete_cookie)\(|[\"']set-cookie[\"']", re.IGNORECASE)


def test_no_other_file_in_app_sets_or_deletes_a_cookie() -> None:
    offenders = [
        path.relative_to(APP_DIR).as_posix()
        for path in sorted(APP_DIR.rglob("*.py"))
        if path.name != "cookies.py" and _COOKIE_WRITE.search(path.read_text(encoding="utf-8"))
    ]

    assert offenders == []
