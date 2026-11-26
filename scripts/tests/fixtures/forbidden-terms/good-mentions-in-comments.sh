#!/usr/bin/env bash
# Fixture: the same words, but only where they are prose or data.
#
# The upper bound comes from the platform's own timeout field, not from a
# timeout command here; the contract's table lists it per event. We never
# pass --fix or --write to a tool, and we never git add on the agent's
# behalf -- the agent fixes what the diagnostics name. Digests come from
# hc_sha256, not from shasum or sha256sum, and nothing here will pkill or
# killall a process it did not start.
set -uo pipefail

echo "the platform timeout is 30s; this checker sets none of its own"
echo "do not run eslint --fix or prettier --write from a hook"
echo "do not git add on the agent's behalf"
echo "digests come from node, never from shasum or sha256sum"
echo "never pkill or killall anything this script did not launch"
TIMEOUT_NOTE='timeout is declared in .claude/settings.json'
printf '%s\n' "$TIMEOUT_NOTE"

# Indented prose must stay clean too: it is the comment that explains the
# rule, and a lint that fails on its own explanation is unusable.
if [ -n "${TIMEOUT_NOTE:-}" ]; then
    echo "the contract says the runner applies the timeout, not us"
    echo "a repair step would run eslint --fix; this one reports instead"
fi

# Braces end the name, so this is the spelling the rule asks for -- and the
# words "$detail" and 無法判斷 appearing in this comment must not trip it.
printf '%s\n' "無法判斷（${detail}），依規定不判為通過"
printf '%s\n' "路徑 ${p} 命中樣式"
