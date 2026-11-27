#!/bin/bash
set -u

MODE="$1"
RESOURCES="$(cd "$(dirname "$0")" && pwd -P)" || exit 1
BRIDGE="$RESOURCES/rover-bridge.mjs"
LOG_FILE="$HOME/Library/Logs/LumOS1-Console/bridge.log"
BRIDGE_PID=""

show_error() {
  printf '%s\n' "$1" >&2
  if [ "$MODE" = --background ] && [ "${LUMOS_NO_BROWSER:-}" != 1 ]; then
    /usr/bin/osascript - "$1" <<'APPLESCRIPT'
on run argv
  display alert "LUMOS-1 Rover Console" message (item 1 of argv) as critical
end run
APPLESCRIPT
  fi
}

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$PATH"
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ] && [ -d "$HOME/.nvm/versions/node" ]; then
  NVM_LATEST="$(ls "$HOME/.nvm/versions/node" | sort -V | tail -1)"
  NODE_BIN="$HOME/.nvm/versions/node/$NVM_LATEST/bin/node"
fi
if [ ! -x "$NODE_BIN" ] || ! "$NODE_BIN" -e 'process.exit(Number(process.versions.node.split(".")[0]) < 18 ? 1 : 0)'; then
  show_error "Node.js 18 以上をインストールしてください。https://nodejs.org"
  exit 1
fi

if [ ! -r "$BRIDGE" ] || [ ! -r "$RESOURCES/public/index.html" ]; then
  show_error "アプリのブリッジまたは画面ファイルが見つかりません。"
  exit 1
fi

PORTS=(5050 5051 5052 5053 5054 5055)
if [ -n "${BRIDGE_PORT:-}" ]; then
  if [[ ! "$BRIDGE_PORT" =~ ^[1-9][0-9]{0,4}$ ]] || [ "$BRIDGE_PORT" -gt 65535 ]; then
    show_error "BRIDGE_PORT には 1～65535 の整数を指定してください。"
    exit 1
  fi
  PORTS=("$BRIDGE_PORT")
fi

if [ "$MODE" = --background ] && ! mkdir -p "$(dirname "$LOG_FILE")"; then
  show_error "ログディレクトリを作成できません。$LOG_FILE"
  exit 1
fi

cd "$RESOURCES" || exit 1
export BRIDGE_HOST=127.0.0.1

listener_pid() {
  /usr/sbin/lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1
}

bridge_is_ready() {
  local health
  health="$(/usr/bin/curl --noproxy '*' -fsS --max-time 0.5 "http://127.0.0.1:$1/api/healthz" 2>/dev/null)" || return 1
  [[ "$health" == *'"status":"ok"'* && "$health" == *'"pid":'"$2",* &&
     "$health" == *'"roverHost":"'"${ROVER_HOST:-192.168.4.1}"'"'* &&
     "$health" == *'"roverPort":'"${ROVER_PORT:-5000}",* ]]
}

reuse_bridge() {
  local pid cwd
  pid="$(listener_pid "$1")"
  [ -n "$pid" ] || return 1
  cwd="$(/usr/sbin/lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
  [ "$cwd" = "$RESOURCES" ] && bridge_is_ready "$1" "$pid"
}

open_console() {
  local url="http://127.0.0.1:$1/"
  printf 'LUMOS-1 Rover Console — %s\n' "$url"
  if [ "${LUMOS_NO_BROWSER:-}" != 1 ]; then
    /usr/bin/open "$url"
  fi
}

stop_child() {
  if [ -n "$BRIDGE_PID" ]; then
    if [ "$(jobs -pr)" = "$BRIDGE_PID" ]; then
      kill -TERM "$BRIDGE_PID" 2>/dev/null || true
    fi
    wait "$BRIDGE_PID" 2>/dev/null || true
  fi
}

for port in "${PORTS[@]}"; do
  if reuse_bridge "$port"; then
    open_console "$port"
    exit $?
  fi
done

trap stop_child EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

for port in "${PORTS[@]}"; do
  if [ -n "$(listener_pid "$port")" ]; then
    continue
  fi

  if [ "$MODE" = --background ]; then
    BRIDGE_PORT="$port" "$NODE_BIN" "$BRIDGE" >>"$LOG_FILE" 2>&1 </dev/null &
  else
    BRIDGE_PORT="$port" "$NODE_BIN" "$BRIDGE" &
  fi
  BRIDGE_PID=$!

  for ((attempt = 0; attempt < 30; attempt++)); do
    if bridge_is_ready "$port" "$BRIDGE_PID"; then
      open_console "$port" || true
      wait "$BRIDGE_PID"
      status=$?
      BRIDGE_PID=""
      exit "$status"
    fi
    kill -0 "$BRIDGE_PID" 2>/dev/null || break
    sleep 0.1
  done

  stop_child
  BRIDGE_PID=""
  if reuse_bridge "$port"; then
    open_console "$port"
    exit $?
  fi
done

show_error "ブリッジを起動できませんでした。ポート ${PORTS[*]} と起動ログを確認してください。"
exit 1
