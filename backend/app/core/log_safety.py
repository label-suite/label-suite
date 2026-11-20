"""Log-safe rendering of request-derived values (Hard Rule 9).

It has no imports from ``app`` so every module that logs request data, the
middlewares and the exception handlers alike, can use it without a cycle.
"""

__all__ = ["escape_for_log"]


def escape_for_log(value: object) -> str:
    """Return ``value`` as one log-safe line.

    Backslashes, control characters (``\\n``, ``\\r``, ``\\t``, ``\\x1b``, ...) and
    non-ASCII characters are written as Python escape sequences, so a
    request-derived value can never start a forged log line or carry terminal
    control sequences (log injection, Hard Rule 9).

    Args:
        value: Any value; ``None`` and non-strings are converted with ``str``.

    Returns:
        The escaped, ASCII-only text.
    """
    return str(value).encode("unicode_escape").decode("ascii")
