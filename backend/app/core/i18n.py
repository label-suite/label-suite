"""Envelope-message localisation (api-agent-rules A8, clarification Q2).

``resolve_locale`` picks the response language from ``Accept-Language``;
``MessageCatalog`` holds the flat key-to-string files under
``app/i18n/<locale>/messages.json``. Only the envelope ``message`` is localised
here; UI strings belong to the frontend.
"""

import json
from collections.abc import Mapping
from pathlib import Path

from app.core.errors import NotAcceptableError

__all__ = [
    "DEFAULT_LOCALE",
    "SUPPORTED_LOCALES",
    "MessageCatalog",
    "MessageCatalogError",
    "resolve_locale",
]

SUPPORTED_LOCALES: tuple[str, ...] = ("zh-TW", "en")
DEFAULT_LOCALE = "zh-TW"
CATALOG_DIR = Path(__file__).resolve().parent.parent / "i18n"

_ZH_TW_TAGS = frozenset({"zh", "zh-tw", "zh-hant", "zh-hant-tw"})


def _match_locale(tag: str) -> str | None:
    """Map one language tag (already lower-cased) to a supported locale, if any."""
    if tag in _ZH_TW_TAGS:
        return "zh-TW"
    if tag == "en" or tag.startswith("en-"):
        return "en"
    return None


def _parse_q(params: list[str]) -> float | None:
    """Return the entry's q-value, or ``None`` when it is malformed."""
    for param in params:
        name, _, value = param.partition("=")
        if name.strip().lower() == "q":
            try:
                q = float(value.strip())
            except ValueError:
                return None
            return q if 0.0 <= q <= 1.0 else None
    return 1.0


def resolve_locale(accept_language: str | None) -> str:
    """Choose the response locale from an ``Accept-Language`` header value.

    Entries are tried by descending q-value (ties keep header order); the first
    supported one wins. Matching is case-insensitive and ``zh``/``zh-Hant`` map
    to ``zh-TW``. ``*`` accepts the first supported locale (default first) that
    was not refused with ``q=0``. Unsupported and malformed entries are skipped.

    Args:
        accept_language: The raw header value, or ``None`` when absent.

    Returns:
        ``zh-TW`` or ``en``; ``zh-TW`` when the header is absent or blank.

    Raises:
        NotAcceptableError: When the header lists only unsupported languages or
            refuses every supported language and ``*`` with ``q=0``.
    """
    if accept_language is None or not accept_language.strip():
        return DEFAULT_LOCALE

    accepted: list[tuple[float, int, str]] = []
    refused: set[str] = set()
    for index, entry in enumerate(accept_language.split(",")):
        tag, *params = entry.split(";")
        tag = tag.strip().lower()
        q = _parse_q(params)
        if not tag or q is None:
            continue
        if q == 0.0:
            refused.add(tag)
        else:
            accepted.append((q, index, tag))

    refused_locales = {_match_locale(tag) for tag in refused}
    for _, _, tag in sorted(accepted, key=lambda item: (-item[0], item[1])):
        if tag == "*":
            for locale in SUPPORTED_LOCALES:
                if locale not in refused_locales:
                    return locale
            continue
        matched = _match_locale(tag)
        if matched is not None and matched not in refused_locales:
            return matched
    raise NotAcceptableError()


class MessageCatalogError(Exception):
    """Raised when the message files are missing, malformed or out of sync."""


class MessageCatalog:
    """Localised envelope messages for every supported locale.

    Load it once at app assembly with ``MessageCatalog.load()``; loading checks
    that every locale defines exactly the same keys, so a missing translation
    fails start-up instead of leaking a key into a response.
    """

    def __init__(self, messages: Mapping[str, Mapping[str, str]]) -> None:
        """Wrap already-validated messages; prefer ``MessageCatalog.load``."""
        self._messages = {locale: dict(entries) for locale, entries in messages.items()}

    @classmethod
    def load(cls, directory: Path = CATALOG_DIR) -> "MessageCatalog":
        """Read ``<directory>/<locale>/messages.json`` for every supported locale.

        Args:
            directory: The catalog root; defaults to ``app/i18n``.

        Returns:
            The loaded catalog.

        Raises:
            MessageCatalogError: When a file is missing or not a flat JSON
                object of strings, or when the locales' key sets differ.
        """
        messages: dict[str, dict[str, str]] = {}
        for locale in SUPPORTED_LOCALES:
            path = directory / locale / "messages.json"
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                raise MessageCatalogError(f"{locale}: cannot read messages.json") from exc
            if not isinstance(data, dict) or not all(
                isinstance(key, str) and isinstance(value, str) for key, value in data.items()
            ):
                raise MessageCatalogError(f"{locale}: messages.json must map keys to strings")
            messages[locale] = data

        reference = set(messages[DEFAULT_LOCALE])
        problems = []
        for locale, entries in messages.items():
            missing = sorted(reference - set(entries))
            extra = sorted(set(entries) - reference)
            if missing or extra:
                problems.append(
                    f"{locale}: keys differ from {DEFAULT_LOCALE} "
                    f"(missing {missing}, extra {extra})"
                )
        if problems:
            raise MessageCatalogError("; ".join(problems))
        return cls(messages)

    def keys(self) -> frozenset[str]:
        """Return the message keys, identical for every locale."""
        return frozenset(self._messages[DEFAULT_LOCALE])

    def translate(self, key: str, locale: str, params: Mapping[str, str] | None = None) -> str:
        """Return the message for ``key`` in ``locale`` with ``params`` filled in.

        Args:
            key: A catalog key such as ``common.ok``.
            locale: A supported locale.
            params: Named values for ``{name}`` placeholders.

        Raises:
            KeyError: When the key or locale is unknown, or a placeholder has
                no value in ``params``.
        """
        text = self._messages[locale][key]
        return text.format_map(params) if params else text
