#!/usr/bin/env bash
# Checks what the probe backend reports when requests come through Nginx (#566, P2).
#
#   e2e/shared/proxy-probe/check-client-address.sh <base-url> <frontend-address>
#
# Every assertion is negative on purpose: the address a published port shows depends
# on the platform (Docker Desktop and Linux differ, and the network's gateway is the
# first address of ip_range, not .1), so the script never expects a fixed value. It
# only requires a valid IP that is neither the frontend's address nor a forged value,
# and the scheme "http" even when the client sends X-Forwarded-Proto: https.
set -euo pipefail

base=${1:?usage: check-client-address.sh <base-url> <frontend-address>}
frontend=${2:?usage: check-client-address.sh <base-url> <frontend-address>}
url="$base/api/v1/proxy-probe"
failed=0

# check <label> <forged addresses, space separated> [curl header args...]
check() {
  local label=$1 forged=$2
  shift 2
  local body client scheme
  body=$(curl -fsS "$@" "$url")
  client=$(jq -r '.client // empty' <<< "$body")
  scheme=$(jq -r '.scheme // empty' <<< "$body")
  echo "$label: client=$client scheme=$scheme"
  if ! [[ $client =~ ^[0-9a-fA-F:.]+$ && ( $client == *.* || $client == *:* ) ]]; then
    echo "::error::$label: the reported client is not an IP address: '$client'"
    failed=1
  fi
  if [ "$client" = "$frontend" ]; then
    echo "::error::$label: the backend sees the frontend address $frontend, not the origin"
    failed=1
  fi
  for address in $forged; do
    if [ "$client" = "$address" ]; then
      echo "::error::$label: the backend believed the forged address $address"
      failed=1
    fi
  done
  if [ "$scheme" != "http" ]; then
    echo "::error::$label: the scheme is '$scheme', expected http"
    failed=1
  fi
}

check "plain request" ""
check "forged X-Forwarded-For" "6.6.6.6" -H "X-Forwarded-For: 6.6.6.6"
check "forged chain" "9.9.9.9 8.8.8.8" -H "X-Forwarded-For: 9.9.9.9, 8.8.8.8"
check "forged X-Forwarded-Proto" "" -H "X-Forwarded-Proto: https"

exit "$failed"
