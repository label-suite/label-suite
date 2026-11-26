"""Unit tests for ``SessionPolicy`` (login-auth-guard task 4.1, spec ``login-session``).

The two limits are 90 days from sign-in and 7 days without use, whichever comes first;
extending never passes the 90-day line; the grace period for a second use of one
refresh token is 30 seconds and allows one extra reissue.
"""

from datetime import UTC, datetime, timedelta

from app.modules.account.service import SessionPolicy

STARTED = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
POLICY = SessionPolicy()


def test_the_limits_follow_the_spec() -> None:
    assert POLICY.absolute_limit == timedelta(days=90)
    assert POLICY.idle_limit == timedelta(days=7)
    assert POLICY.access_ttl == timedelta(minutes=15)
    assert POLICY.refresh_grace == timedelta(seconds=30)
    assert POLICY.max_grace_reissue == 1


def test_a_fresh_session_is_not_expired() -> None:
    assert POLICY.is_expired(STARTED, STARTED, STARTED + timedelta(days=1)) is False


def test_the_absolute_limit_expires_even_a_session_used_a_minute_ago() -> None:
    now = STARTED + timedelta(days=90)

    assert POLICY.is_expired(STARTED, now - timedelta(minutes=1), now) is True


def test_one_second_before_the_absolute_limit_is_still_valid() -> None:
    now = STARTED + timedelta(days=90) - timedelta(seconds=1)

    assert POLICY.is_expired(STARTED, now - timedelta(minutes=1), now) is False


def test_seven_days_and_a_minute_idle_is_expired() -> None:
    last_seen = STARTED + timedelta(days=3)

    assert POLICY.is_expired(STARTED, last_seen, last_seen + timedelta(days=7, minutes=1)) is True


def test_daily_use_keeps_the_idle_line_moving() -> None:
    last_seen = STARTED + timedelta(days=9)

    assert POLICY.is_expired(STARTED, last_seen, STARTED + timedelta(days=10)) is False


def test_refresh_expiry_is_seven_days_out_when_far_from_the_limit() -> None:
    now = STARTED + timedelta(days=10)

    assert POLICY.refresh_expiry(STARTED, now) == now + timedelta(days=7)


def test_refresh_and_access_expiry_never_pass_the_absolute_limit() -> None:
    now = STARTED + timedelta(days=89, hours=23, minutes=55)
    limit = STARTED + timedelta(days=90)

    assert POLICY.refresh_expiry(STARTED, now) == limit
    assert POLICY.access_expiry(STARTED, now) == limit


def test_access_expiry_is_fifteen_minutes_out() -> None:
    now = STARTED + timedelta(days=1)

    assert POLICY.access_expiry(STARTED, now) == now + timedelta(minutes=15)


def test_the_grace_period_includes_thirty_seconds_and_no_more() -> None:
    consumed = STARTED + timedelta(days=1)

    assert POLICY.within_grace(consumed, consumed + timedelta(seconds=30)) is True
    assert POLICY.within_grace(consumed, consumed + timedelta(seconds=31)) is False
