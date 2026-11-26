#!/usr/bin/env bash
# check-login-survives-restart.sh - prove that a Lite sign-in survives a restart
# of the orchestration (spec container-runtime "重啟後登入狀態仍有效";
# login-auth-guard task 4.5, design D4, system-design §AUTH_SECRET 的來源).
#
# Usage:
#   scripts/check-login-survives-restart.sh <base-url>
#
#   e.g. scripts/check-login-survives-restart.sh http://localhost:8080
#
# Precondition: the Lite tier is up from the repository root with .env copied
# from .env.example (AUTH_SECRET left empty, so the backend generates the secret
# on the data volume), e.g. `docker compose up --build --wait --wait-timeout 300`.
# A fresh volume is expected: the Seeder command refuses a second Seeder admin.
#
# Steps:
#   1. create the first Seeder admin with the initialisation command inside the
#      running backend, the password piped through --password-stdin
#   2. sign in through the public entry: POST <base-url>/api/v1/sessions -> 201
#   3. `docker compose down` WITHOUT -v, then `docker compose up --wait`
#   4. send the cookies from step 2: GET <base-url>/api/v1/current-session -> 200
#
# The password is random per run and the cookies are kept in a temporary file;
# neither is ever printed. Only statuses are reported.
#
# Exit codes: 0 the session survived; 1 a step answered something else;
# 2 usage error or a missing tool.
set -euo pipefail

if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "usage: $0 <base-url>" >&2
  exit 2
fi
base=${1%/}

for tool in curl docker jq openssl; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing tool: $tool" >&2; exit 2; }
done

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

email="restart-check@example.org"
password="Aa1$(openssl rand -hex 16)"

echo "1/4 create the Seeder admin"
printf '%s\n' "$password" | docker compose exec -T backend \
  python -m app.scripts.create_seeder --email "$email" --name "Restart check" --password-stdin

echo "2/4 sign in through $base"
jq -n --arg email "$email" --arg password "$password" '{email: $email, password: $password}' \
  > "$work/body.json"
status=$(curl -sS --connect-timeout 10 --max-time 30 -o /dev/null -D "$work/headers" \
  -w '%{http_code}' -H 'Content-Type: application/json' \
  --data-binary "@$work/body.json" "$base/api/v1/sessions")
if [ "$status" != "201" ]; then
  echo "FAIL: POST /api/v1/sessions answered $status, expected 201" >&2
  exit 1
fi
# "name=value" of each __Host-ls_ cookie, joined as one Cookie header.
cookies=$(tr -d '\r' < "$work/headers" \
  | sed -n 's/^[Ss][Ee][Tt]-[Cc][Oo][Oo][Kk][Ii][Ee]: *\(__Host-ls_[^;]*\).*/\1/p' \
  | paste -sd ';' - | sed 's/;/; /g')
count=$(printf '%s' "$cookies" | tr ';' '\n' | grep -c '__Host-ls_' || true)
if [ "$count" -ne 3 ]; then
  echo "FAIL: the sign-in set $count login cookies, expected 3" >&2
  exit 1
fi
printf 'Cookie: %s\n' "$cookies" > "$work/cookie-header"

echo "3/4 restart the orchestration without removing volumes"
docker compose down
docker compose up --wait --wait-timeout 300

echo "4/4 use the old cookies after the restart"
status=$(curl -sS --connect-timeout 10 --max-time 30 -o /dev/null -w '%{http_code}' \
  -H "@$work/cookie-header" "$base/api/v1/current-session")
if [ "$status" != "200" ]; then
  echo "FAIL: GET /api/v1/current-session after the restart answered $status, expected 200" >&2
  exit 1
fi
echo "OK: the sign-in survived the restart"
