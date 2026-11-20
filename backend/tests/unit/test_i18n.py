"""Unit tests for ``Accept-Language`` resolution, the message catalog and AppError.

Covers the language-selection rules of spec ``response-localization``'s first
requirement and the "all languages rejected" decision behind its ``406``.
"""

import json
from pathlib import Path

import pytest

from app.core.errors import AppError, DatabaseUnavailableError, NotAcceptableError, NotFoundError
from app.core.i18n import (
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    MessageCatalog,
    MessageCatalogError,
    resolve_locale,
)

# --- resolve_locale -------------------------------------------------------------------


@pytest.mark.parametrize("header", [None, "", "   "])
def test_missing_accept_language_defaults_to_zh_tw(header: str | None) -> None:
    assert resolve_locale(header) == "zh-TW"


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        ("en", "en"),
        ("zh-TW", "zh-TW"),
        ("zh-TW;q=0.5, en;q=0.9", "en"),
        ("en;q=0.5, zh-TW;q=0.9", "zh-TW"),
        ("en;q=0.8, zh-TW;q=0.8", "en"),
        ("en, zh-TW", "en"),
        ("fr, en;q=0.5", "en"),
        ("fr;q=1, de;q=0.9, zh-TW;q=0.1", "zh-TW"),
        ("fr, *;q=0.1", "zh-TW"),
        ("*", "zh-TW"),
        ("zh", "zh-TW"),
        ("zh-Hant", "zh-TW"),
        ("ZH-tw", "zh-TW"),
        ("zh-hant", "zh-TW"),
        ("EN", "en"),
        ("en-US", "en"),
        ("en ; q=0.7", "en"),
    ],
)
def test_resolve_locale_picks_the_highest_q_supported_language(header: str, expected: str) -> None:
    assert resolve_locale(header) == expected


def test_wildcard_skips_an_explicitly_rejected_default() -> None:
    assert resolve_locale("zh-TW;q=0, *;q=0.5") == "en"


def test_q_zero_rejects_only_that_language() -> None:
    assert resolve_locale("en;q=0, zh-TW;q=0.3") == "zh-TW"


@pytest.mark.parametrize("header", ["fr", "fr, de;q=0.5", "zh-CN"])
def test_only_unsupported_languages_are_rejected_with_406(header: str) -> None:
    with pytest.raises(NotAcceptableError) as excinfo:
        resolve_locale(header)

    assert excinfo.value.status_code == 406
    assert excinfo.value.code == "NOT_ACCEPTABLE"


@pytest.mark.parametrize(
    "header",
    [
        "zh-TW;q=0, en;q=0, *;q=0",
        "zh-TW;q=0, en;q=0",
        "*;q=0",
        "en;q=0.000",
        "fr, *;q=0",
    ],
)
def test_all_languages_refused_with_q_zero_is_rejected(header: str) -> None:
    with pytest.raises(NotAcceptableError):
        resolve_locale(header)


@pytest.mark.parametrize("header", ["en;q=abc", "en;q=2", "en;q=-1", ";q=0.5"])
def test_malformed_entries_are_ignored(header: str) -> None:
    with pytest.raises(NotAcceptableError):
        resolve_locale(header)


def test_malformed_entry_does_not_hide_a_valid_one() -> None:
    assert resolve_locale("en;q=abc, zh-TW;q=0.2") == "zh-TW"


def test_supported_locales_and_default() -> None:
    assert SUPPORTED_LOCALES == ("zh-TW", "en")
    assert DEFAULT_LOCALE == "zh-TW"


# --- MessageCatalog -------------------------------------------------------------------

EXPECTED_MESSAGES = {
    "common.ok": ("成功", "Success"),
    "common.not_found": ("找不到指定的資源", "The requested resource was not found."),
    "common.method_not_allowed": ("不支援這個操作", "This operation is not supported."),
    "common.not_acceptable": ("不支援所要求的語言", "The requested language is not supported."),
    "common.validation_failed": (
        "輸入資料有誤，請檢查標示的欄位",
        "Some fields are invalid. Please check the highlighted fields.",
    ),
    "common.internal_error": (
        "系統發生錯誤，請稍後再試",
        "Something went wrong. Please try again later.",
    ),
    "common.database_unavailable": (
        "資料庫暫時無法連線，請稍後再試",
        "The database is temporarily unavailable. Please try again later.",
    ),
}


@pytest.mark.parametrize(("key", "texts"), EXPECTED_MESSAGES.items())
def test_bundled_catalog_uses_the_contract_strings(key: str, texts: tuple[str, str]) -> None:
    catalog = MessageCatalog.load()

    assert catalog.translate(key, "zh-TW") == texts[0]
    assert catalog.translate(key, "en") == texts[1]


def test_bundled_catalog_has_exactly_the_contract_keys() -> None:
    catalog = MessageCatalog.load()

    assert catalog.keys() == frozenset(EXPECTED_MESSAGES)


def test_every_app_error_message_key_exists_in_the_catalog() -> None:
    catalog = MessageCatalog.load()

    for error in (NotFoundError(), NotAcceptableError(), DatabaseUnavailableError()):
        assert error.message_key in catalog.keys()


def _write_catalog(root: Path, messages: dict[str, dict[str, str]]) -> None:
    for locale, entries in messages.items():
        folder = root / locale
        folder.mkdir(parents=True)
        (folder / "messages.json").write_text(json.dumps(entries), encoding="utf-8")


def test_catalog_with_different_key_sets_fails_to_load(tmp_path: Path) -> None:
    _write_catalog(
        tmp_path,
        {
            "zh-TW": {"common.ok": "成功", "common.extra": "多的"},
            "en": {"common.ok": "Success", "common.missing": "Missing"},
        },
    )

    with pytest.raises(MessageCatalogError) as excinfo:
        MessageCatalog.load(tmp_path)

    message = str(excinfo.value)
    assert "common.extra" in message
    assert "common.missing" in message


def test_catalog_missing_a_locale_file_fails_to_load(tmp_path: Path) -> None:
    _write_catalog(tmp_path, {"zh-TW": {"common.ok": "成功"}})

    with pytest.raises(MessageCatalogError):
        MessageCatalog.load(tmp_path)


def test_catalog_with_a_non_string_value_fails_to_load(tmp_path: Path) -> None:
    _write_catalog(
        tmp_path,
        {"zh-TW": {"common.ok": "成功"}, "en": {"common.ok": 1}},  # type: ignore[dict-item]
    )

    with pytest.raises(MessageCatalogError):
        MessageCatalog.load(tmp_path)


def test_translate_fills_named_params(tmp_path: Path) -> None:
    _write_catalog(
        tmp_path,
        {"zh-TW": {"task.missing": "找不到 {name}"}, "en": {"task.missing": "No {name}"}},
    )
    catalog = MessageCatalog.load(tmp_path)

    assert catalog.translate("task.missing", "en", {"name": "T1"}) == "No T1"
    assert catalog.translate("task.missing", "zh-TW", {"name": "T1"}) == "找不到 T1"


def test_translate_unknown_key_raises_key_error() -> None:
    with pytest.raises(KeyError):
        MessageCatalog.load().translate("common.no_such_key", "en")


# --- AppError family ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("error", "status_code", "code", "message_key"),
    [
        (NotFoundError(), 404, "NOT_FOUND", "common.not_found"),
        (NotAcceptableError(), 406, "NOT_ACCEPTABLE", "common.not_acceptable"),
        (DatabaseUnavailableError(), 503, "DATABASE_UNAVAILABLE", "common.database_unavailable"),
    ],
)
def test_app_errors_carry_status_code_and_message_key(
    error: AppError, status_code: int, code: str, message_key: str
) -> None:
    assert isinstance(error, AppError)
    assert error.status_code == status_code
    assert error.code == code
    assert error.message_key == message_key
    assert error.params == {}


def test_app_error_keeps_params() -> None:
    assert NotFoundError(params={"name": "T1"}).params == {"name": "T1"}
