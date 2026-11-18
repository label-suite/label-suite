#!/usr/bin/env bash
# Test harness for the hook checkers (issue #111, task 2.1).
#
# Sourced, not executed. It gives a test three things it cannot safely take
# from the developer's machine:
#
#   * a git repository of its own, so a test may commit, stage and destroy
#     freely without touching real work;
#   * fake ruff / mypy / tsc / eslint ahead of the real ones on PATH, with an
#     exit code and output the test chooses, and a log of which ones ran — a
#     checker that silently skipped a tool and one that ran it both "pass"
#     otherwise;
#   * a payload per event, so a test does not hand-write JSON and drift from
#     what hook-payload.mjs actually requires.
#
# Everything it creates is removed by harness_teardown, which also runs on EXIT
# so an aborted test does not leave temporary repositories behind.

HARNESS_TOOLS="ruff mypy tsc eslint"

# Creates the isolated repository and the fake tool directory, and puts the
# fakes ahead of everything else on PATH.
harness_setup() {
  HARNESS_REPO=$(mktemp -d "${TMPDIR:-/tmp}/hook-harness-repo.XXXXXX")
  HARNESS_BIN=$(mktemp -d "${TMPDIR:-/tmp}/hook-harness-bin.XXXXXX")
  export HARNESS_REPO HARNESS_BIN

  git -C "$HARNESS_REPO" init -q
  # No hooks and no signing: the harness must not inherit this machine's git
  # configuration, or a test would measure the developer's setup.
  git -C "$HARNESS_REPO" config core.hooksPath /dev/null
  git -C "$HARNESS_REPO" config commit.gpgsign false

  HARNESS_CALL_LOG="$HARNESS_BIN/.calls"
  export HARNESS_CALL_LOG
  : > "$HARNESS_CALL_LOG"

  local tool
  for tool in $HARNESS_TOOLS; do
    printf '0'  > "$HARNESS_BIN/.$tool.code"
    printf ''   > "$HARNESS_BIN/.$tool.out"
    cat > "$HARNESS_BIN/$tool" <<'FAKE'
#!/usr/bin/env bash
# Fake tool installed by hook-harness.sh. Records the call, then replays the
# output and exit code the test asked for.
self=$(basename "$0")
printf '%s %s\n' "$self" "$*" >> "$HARNESS_BIN/.calls"
out=$(cat "$HARNESS_BIN/.$self.out")
[ -n "$out" ] && printf '%s\n' "$out"
exit "$(cat "$HARNESS_BIN/.$self.code")"
FAKE
    chmod +x "$HARNESS_BIN/$tool"
  done

  PATH="$HARNESS_BIN:$PATH"
  export PATH
  trap harness_teardown EXIT
}

# harness_set_tool <name> <exit-code> [output]
harness_set_tool() {
  printf '%s' "$2" > "$HARNESS_BIN/.$1.code"
  printf '%s' "${3-}" > "$HARNESS_BIN/.$1.out"
}

harness_reset_calls() { : > "$HARNESS_CALL_LOG"; }

# Prints one line per call, in order: "<tool> <args>".
harness_calls() { cat "$HARNESS_CALL_LOG"; }

# harness_payload <EventName> [key value]...
#
# Builds a payload that hook-payload.mjs accepts for that event, with cwd
# pointing at the harness repository. Recognised override keys: tool_name,
# tool_path, tool_command, stop_hook_active.
harness_payload() {
  local event="$1"; shift
  local tool_name='' tool_path='' tool_command='' stop_hook_active=''
  while [ "$#" -gt 1 ]; do
    case "$1" in
      tool_name)        tool_name="$2" ;;
      tool_path)        tool_path="$2" ;;
      tool_command)     tool_command="$2" ;;
      stop_hook_active) stop_hook_active="$2" ;;
      *) printf 'hook-harness: unknown payload key: %s\n' "$1" >&2; return 2 ;;
    esac
    shift 2
  done

  HARNESS_EVENT="$event" \
  HARNESS_TOOL_NAME="$tool_name" \
  HARNESS_TOOL_PATH="$tool_path" \
  HARNESS_TOOL_COMMAND="$tool_command" \
  HARNESS_STOP_ACTIVE="$stop_hook_active" \
  node -e '
    const env = process.env;
    const event = env.HARNESS_EVENT;
    const payload = { cwd: env.HARNESS_REPO, hook_event_name: event, session_id: "harness" };
    if (event === "PreToolUse" || event === "PostToolUse") {
      payload.tool_name = env.HARNESS_TOOL_NAME || "Write";
      const input = {};
      if (env.HARNESS_TOOL_PATH) input.file_path = env.HARNESS_TOOL_PATH;
      else if (!env.HARNESS_TOOL_COMMAND) input.file_path = env.HARNESS_REPO + "/a.txt";
      if (env.HARNESS_TOOL_COMMAND) input.command = env.HARNESS_TOOL_COMMAND;
      payload.tool_input = input;
    }
    if (event === "Stop" || event === "SubagentStop") {
      payload.stop_hook_active = env.HARNESS_STOP_ACTIVE === "true";
    }
    process.stdout.write(JSON.stringify(payload));
  '
}

# Removes everything harness_setup created. Safe to call twice.
harness_teardown() {
  trap - EXIT
  [ -n "${HARNESS_REPO:-}" ] && [ -d "$HARNESS_REPO" ] && rm -rf "$HARNESS_REPO"
  [ -n "${HARNESS_BIN:-}" ]  && [ -d "$HARNESS_BIN" ]  && rm -rf "$HARNESS_BIN"
  return 0
}
