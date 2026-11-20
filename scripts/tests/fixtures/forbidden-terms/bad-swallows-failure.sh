#!/usr/bin/env bash
# Fixture: every construct the lint must refuse, in the position that matters.
#
# Half of these are indented, and that half is not decoration. The first
# version of the lint anchored command position to the start of the line, so
# it matched almost nothing in a layer whose every command sits inside an `if`
# or a `for`; a fixture written flush against column zero reported a clean
# bill of health for a rule set that was close to inert.
set -uo pipefail

ruff check -- "$1" || true
mypy "$1" || exit 0
eslint "$1" || :
timeout 30 tsc --noEmit
gtimeout 30 tsc --noEmit
pkill -f tsc
killall node
eslint --fix "$1"
prettier --write "$1"
git add "$1"
shasum -a 256 "$1" | cut -d' ' -f1
sha256sum "$1"

# A separator, rather than the end of the line, after the swallowing idiom.
ruff check || true; echo done
mypy || :; echo done

# Reached through a full path.
/usr/bin/shasum -a 256 "$1"

# Indented, which is where this layer actually writes its commands.
if [ -n "$1" ]; then
    ruff check -- "$1" || true
    timeout 30 tsc --noEmit
    pkill -f tsc
    eslint --fix "$1"
    git add "$1"
    shasum -a 256 "$1"
    md5sum "$1"
fi

for f in "$@"; do
	prettier --write "$f"
	sha1sum "$f"
done

# A bare variable running into a fullwidth bracket.
printf '%s\n' "無法判斷（$detail），依規定不判為通過"
