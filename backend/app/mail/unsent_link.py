"""The dedicated channel for links a deployment without mail could not send (design D7).

``record_unsent_link`` writes one ``key=value`` line to the logger
``app.mail.unsent_link``. That logger has its own stderr handler and does not propagate,
so the root logger's handlers (and any log pipeline hung on the root later) never see
the link (security-agent-rules S9). ``configure_logging`` only replaces its own root
handler, so it leaves this one alone. ``MailService`` never calls it: only a consumer
whose specification hands the link to the operator when no mail service is configured
does.
"""

import logging
import re
import sys
from typing import TextIO

from app.core.log_config import KeyValueFormatter, install_trace_id_record_factory

__all__ = ["UNSENT_LINK_LOGGER_NAME", "record_unsent_link"]

UNSENT_LINK_LOGGER_NAME = "app.mail.unsent_link"
"""The dedicated logger's name."""

_KIND = re.compile(r"[a-z][a-z0-9_]{0,31}")


class _StderrHandler(logging.StreamHandler[TextIO]):
    """A stream handler that always writes to the current ``sys.stderr``."""

    def __init__(self) -> None:
        super().__init__(sys.stderr)

    @property
    def stream(self) -> TextIO:
        """Return the current ``sys.stderr``."""
        return sys.stderr

    @stream.setter
    def stream(self, _value: TextIO) -> None:
        """Ignore assignments; the handler follows ``sys.stderr``."""


def _dedicated_logger() -> logging.Logger:
    logger = logging.getLogger(UNSENT_LINK_LOGGER_NAME)
    if not logger.handlers:
        handler = _StderrHandler()
        handler.setFormatter(KeyValueFormatter())
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger


_logger = _dedicated_logger()


def record_unsent_link(kind: str, link: str) -> None:
    """Write ``link`` to the dedicated channel for the deployment's operator.

    Use it only when the deployment has no mail service and the consumer's
    specification says the operator receives the link; never after a failed send.

    Args:
        kind: The mail kind, matching ``^[a-z][a-z0-9_]{0,31}$``.
        link: The link the mail would have carried; control characters are escaped.

    Raises:
        ValueError: When ``kind`` does not match; nothing is written.
    """
    if _KIND.fullmatch(kind) is None:
        raise ValueError("kind: must match ^[a-z][a-z0-9_]{0,31}$")
    install_trace_id_record_factory()
    _logger.info("kind=%s link=%s", kind, link)
