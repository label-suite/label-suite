"""The one way an Email is normalised before it is stored or compared (spec 01-05 Q14).

Surrounding whitespace is removed, then the text is NFKC-normalised, case-folded and
NFKC-normalised again (case folding can produce text that is no longer in NFKC, and the
second pass keeps the result stable when normalised again). The format is not checked
here. The 254-character limit is counted on the normalised value, so two spellings of
one address always get the same answer. Storing the normalised value means comparisons
never depend on a database's ``lower()``, so SQLite and PostgreSQL agree.
"""

import unicodedata

__all__ = ["MAX_EMAIL_LENGTH", "EmailTooLongError", "normalize_email"]

MAX_EMAIL_LENGTH = 254
"""The longest normalised Email accepted, in characters."""


class EmailTooLongError(ValueError):
    """The normalised Email is longer than ``MAX_EMAIL_LENGTH``; the message omits it."""


def normalize_email(raw: str) -> str:
    """Return the normalised form of ``raw``.

    Args:
        raw: The Email as typed.

    Returns:
        The stripped, NFKC-normalised, case-folded value.

    Raises:
        EmailTooLongError: When the normalised value exceeds 254 characters.
    """
    folded = unicodedata.normalize("NFKC", unicodedata.normalize("NFKC", raw.strip()).casefold())
    if len(folded) > MAX_EMAIL_LENGTH:
        raise EmailTooLongError(f"the normalised Email exceeds {MAX_EMAIL_LENGTH} characters")
    return folded
