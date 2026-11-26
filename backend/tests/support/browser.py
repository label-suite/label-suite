"""A minimal browser for the account integration tests.

The login cookies carry ``__Host-`` and ``Secure``, which a cookie jar will not send
back over ``http://testserver``. ``Browser`` keeps its own cookie dictionary instead:
it applies each ``Set-Cookie`` (``Max-Age=0`` deletes) and sends the cookies as an
explicit ``Cookie`` header, so each ``Browser`` is one device and two of them are two
devices. ``csrf=True`` copies the CSRF cookie into ``X-CSRF-Token`` as the frontend does.
"""

from typing import Any

import httpx

from app.core.cookies import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE
from app.core.csrf import CSRF_HEADER
from tests.factories.accounts import PLAIN

SESSION_COOKIES = (ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE)


def parse_set_cookie(header: str) -> tuple[str, str, dict[str, str]]:
    """Split one ``Set-Cookie`` header into name, value and lower-cased attributes."""
    first, *attributes = [part.strip() for part in header.split(";")]
    name, _, value = first.partition("=")
    parsed: dict[str, str] = {}
    for attribute in attributes:
        key, _, attr_value = attribute.partition("=")
        parsed[key.lower()] = attr_value
    return name, value.strip('"'), parsed


def set_cookies(response: httpx.Response) -> dict[str, tuple[str, dict[str, str]]]:
    """Return every cookie the response sets or clears, by name."""
    result: dict[str, tuple[str, dict[str, str]]] = {}
    for header in response.headers.get_list("set-cookie"):
        name, value, attributes = parse_set_cookie(header)
        result[name] = (value, attributes)
    return result


def cleared(response: httpx.Response) -> set[str]:
    """Return the names of the cookies the response expires (``Max-Age=0``)."""
    return {
        name
        for name, (_, attributes) in set_cookies(response).items()
        if attributes.get("max-age") == "0"
    }


class Browser:
    """One device: a cookie store in front of the shared test client.

    Args:
        client: The ASGI client of the app under test.
    """

    def __init__(self, client: httpx.AsyncClient) -> None:
        self.client = client
        self.cookies: dict[str, str] = {}

    async def request(
        self, method: str, path: str, *, csrf: bool = False, **kwargs: Any
    ) -> httpx.Response:
        """Send a request with this device's cookies and keep what the response sets."""
        headers: dict[str, str] = dict(kwargs.pop("headers", {}) or {})
        if self.cookies:
            headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.cookies.items())
        if csrf and CSRF_COOKIE in self.cookies:
            headers[CSRF_HEADER] = self.cookies[CSRF_COOKIE]
        response = await self.client.request(method, path, headers=headers, **kwargs)
        self.client.cookies.clear()
        for name, (value, attributes) in set_cookies(response).items():
            if attributes.get("max-age") == "0":
                self.cookies.pop(name, None)
            else:
                self.cookies[name] = value
        return response

    async def sign_in(self, email: str = "user@example.com", plain: str = PLAIN) -> httpx.Response:
        """Sign in with Email and password."""
        return await self.request(
            "POST", "/api/v1/sessions", json={"email": email, "password": plain}
        )

    async def me(self) -> httpx.Response:
        """``GET /api/v1/current-session``."""
        return await self.request("GET", "/api/v1/current-session")

    async def refresh(self) -> httpx.Response:
        """``POST /api/v1/session-refreshes`` with ``{}``."""
        return await self.request("POST", "/api/v1/session-refreshes", json={})

    async def sign_out(self) -> httpx.Response:
        """``DELETE /api/v1/current-session``."""
        return await self.request("DELETE", "/api/v1/current-session")
