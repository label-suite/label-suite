#!/usr/bin/env bash
# check-security-headers.sh - compare the security headers of the public entry
# point (frontend/nginx.conf) against the expected set, response class by
# response class (spec security-headers; system-design D0, D2, D4; design D2).
#
# Usage:
#   scripts/check-security-headers.sh <base-url>
#   scripts/check-security-headers.sh --backend-down <base-url>
#
#   e.g. scripts/check-security-headers.sh http://localhost:8080
#
# Default mode requests, with the status each must answer:
#   page shell                         GET  /                        200
#   SPA deep path                      GET  /some/spa/path           200
#   built asset                        GET  the /assets/*.js the page shell references  200
#   backend success                    GET  /api/v1/health           200
#   backend error                      GET  /api/v1/does-not-exist   404
#   nginx error                        POST /                        405
#   page shell with credentials        GET  /               + Cookie and Bearer token  200
#   backend success with credentials   GET  /api/v1/health  + Cookie and Bearer token  200
# --backend-down mode, run after `docker compose stop backend`, requests only:
#   backend down                       GET  /api/v1/health           502 or 504
# nginx answers 502 when connecting to the stopped backend fails at once
# (EHOSTUNREACH) and 504 when it times out (ETIMEDOUT); both happen on both
# tiers, so either one matches and any other status does not (#568
# clarification Q11).
#
# Every response must carry each header of the EXPECTED block below exactly
# once, with the value equal character for character (header names compare
# case-insensitively, a trailing CR is dropped), and must carry neither
# Strict-Transport-Security nor Content-Security-Policy-Report-Only. Every class
# is checked before anything is reported; each mismatch is one line naming the
# class, the header, the expected value and the actual one (<missing> when
# absent, the count when repeated).
#
# A header present with an empty value is reported as "" (never <missing>).
#
# Exit codes: 0 every class matches; 1 at least one mismatch; 2 usage error
# (no base URL, an unknown flag) or curl could not complete a request, which
# includes a stalled one: every curl call has --connect-timeout 10 and
# --max-time 90, so a hung connection fails fast instead of waiting for the CI
# job limit. --max-time must stay above 60 s: in CI the --backend-down request
# took exactly 60 s because nginx's default proxy_connect_timeout produced the
# 504. The tests shorten both limits through CHECK_HEADERS_CONNECT_TIMEOUT and
# CHECK_HEADERS_MAX_TIME; nothing else should set them.
#
# The EXPECTED block is the only place the expected values are written
# (system-design D4): frontend/nginx.conf holds the actual values, this script
# the expected ones, and a difference fails the compose job. The regression
# tests (scripts/tests/check-security-headers.test.mjs) read the block from here.
#
# Portability: runs on bash 3.2 (macOS) and bash 5 (CI); no associative arrays,
# mapfile or ${var,,}; external tools are curl, grep, sed, tr and awk only.
set -u

read -r -d '' EXPECTED <<'EXPECTED'
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self'; frame-ancestors 'self'
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Server: nginx
EXPECTED

# Headers no response may carry: HSTS belongs to the TLS edge (clarification
# Q1), and the CSP must be enforced, not report-only (clarification Q2).
FORBIDDEN="Strict-Transport-Security Content-Security-Policy-Report-Only"

usage() {
  echo "usage: scripts/check-security-headers.sh [--backend-down] <base-url>" >&2
  exit 2
}

BACKEND_DOWN=0
BASE_URL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --backend-down) BACKEND_DOWN=1 ;;
    -*) echo "unknown flag: $1" >&2; usage ;;
    *)
      if [ -n "$BASE_URL" ]; then usage; fi
      BASE_URL="$1"
      ;;
  esac
  shift
done
if [ -z "$BASE_URL" ]; then usage; fi
BASE_URL="${BASE_URL%/}"

CONNECT_TIMEOUT="${CHECK_HEADERS_CONNECT_TIMEOUT:-10}"
MAX_TIME="${CHECK_HEADERS_MAX_TIME:-90}"

NL='
'
FAILURES=""
CHECKED=0

fail() {
  FAILURES="${FAILURES}MISMATCH [$1] $2: expected $3, got $4${NL}"
}

# fetch <method> <path> [curl args...]
# Sets RESPONSE_STATUS and RESPONSE_HEADERS (CRs removed). Exits 2 when curl
# cannot complete the request, since nothing can be judged then.
fetch() {
  local method="$1" path="$2" out rc
  shift 2
  if [ "$method" = "POST" ]; then
    set -- "$@" --data ""
  fi
  out=$(curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" -X "$method" -D - -o /dev/null -w '%{http_code}' "$@" "${BASE_URL}${path}")
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "curl could not complete ${method} ${BASE_URL}${path} (curl exit ${rc})" >&2
    exit 2
  fi
  out=$(printf '%s' "$out" | tr -d '\r')
  RESPONSE_STATUS="${out##*$NL}"
  RESPONSE_HEADERS="${out%$NL*}"
}

# header_values <name>: every value of that header in RESPONSE_HEADERS, one per line.
header_values() {
  printf '%s\n' "$RESPONSE_HEADERS" | grep -i "^$1:" | sed 's/^[^:]*:[[:space:]]*//'
}

# check <class> <expected statuses> <method> <path> [curl args...]
# <expected statuses> is one status code, or several joined by "|".
check() {
  local class="$1" status="$2" method="$3" path="$4" line name expected values count actual
  shift 4
  fetch "$method" "$path" "$@"
  CHECKED=$((CHECKED + 1))
  class="${class} ${method} ${path}"

  case "|${status}|" in
    *"|${RESPONSE_STATUS}|"*) ;;
    *) fail "$class" "status" "$(printf '%s' "$status" | sed 's/|/ or /g')" "$RESPONSE_STATUS" ;;
  esac

  while IFS= read -r line; do
    name="${line%%: *}"
    expected="${line#*: }"
    values=$(header_values "$name")
    # Count lines, not characters, so a header with an empty value still counts.
    count=$(header_values "$name" | grep -c '')
    if [ "$count" -eq 0 ]; then
      fail "$class" "$name" "\"$expected\"" "<missing>"
    elif [ "$count" -gt 1 ]; then
      actual=$(printf '%s\n' "$values" | awk '{ printf "%s\"%s\"", (NR > 1 ? " | " : ""), $0 }')
      fail "$class" "$name" "\"$expected\" exactly once" "$count occurrences: $actual"
    elif [ "$values" != "$expected" ]; then
      fail "$class" "$name" "\"$expected\"" "\"$values\""
    fi
  done <<EOF
$EXPECTED
EOF

  for name in $FORBIDDEN; do
    values=$(header_values "$name")
    if [ "$(header_values "$name" | grep -c '')" -gt 0 ]; then
      actual=$(printf '%s\n' "$values" | awk '{ printf "%s\"%s\"", (NR > 1 ? " | " : ""), $0 }')
      fail "$class" "$name" "<absent>" "$actual"
    fi
  done
}

CREDENTIALS_COOKIE="Cookie: session=probe"
CREDENTIALS_BEARER="Authorization: Bearer probe"

if [ "$BACKEND_DOWN" -eq 1 ]; then
  check "backend down" "502|504" GET /api/v1/health
else
  check "page shell" 200 GET /
  check "SPA deep path" 200 GET /some/spa/path

  shell_body=$(curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" "${BASE_URL}/")
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "curl could not complete GET ${BASE_URL}/ (curl exit ${rc})" >&2
    exit 2
  fi
  asset=$(printf '%s\n' "$shell_body" | grep -o 'src="/assets/[^"]*\.js"' | sed -n '1s/^src="\(.*\)"$/\1/p')
  if [ -z "$asset" ]; then
    fail "built asset" "path" "a src=\"/assets/*.js\" in the page shell" "<missing>"
  else
    check "built asset" 200 GET "$asset"
  fi

  check "backend success" 200 GET /api/v1/health
  check "backend error" 404 GET /api/v1/does-not-exist
  check "nginx error" 405 POST /
  check "page shell with credentials" 200 GET / -H "$CREDENTIALS_COOKIE" -H "$CREDENTIALS_BEARER"
  check "backend success with credentials" 200 GET /api/v1/health -H "$CREDENTIALS_COOKIE" -H "$CREDENTIALS_BEARER"
fi

if [ -n "$FAILURES" ]; then
  printf '%s' "$FAILURES" >&2
  echo "Security headers do not match at ${BASE_URL} (${CHECKED} responses checked)." >&2
  exit 1
fi
echo "Security headers match at ${BASE_URL} (${CHECKED} responses checked)."
exit 0
