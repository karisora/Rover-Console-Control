#!/bin/bash
set -euo pipefail

usage() {
  printf '使い方  %s [install|remove] [ポート番号]\n' "$(basename "$0")" >&2
  exit 2
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

action=${1:-install}
port=${2:-5051}
[[ $# -le 2 && "$action" =~ ^(install|remove)$ ]] || usage
[[ "$port" =~ ^[1-9][0-9]{3,4}$ ]] && ((port >= 1024 && port <= 65535)) || usage

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
resources="$root/LumOS1-Console.app/Contents/Resources"
bridge="$resources/rover-bridge.mjs"
label="jp.lumos1.rover-console.chrome.$port"
domain="gui/$(id -u)"
job="$domain/$label"
agent_dir="$HOME/Library/LaunchAgents"
plist="$agent_dir/$label.plist"
helper_dir="$HOME/Library/Application Support/LumOS1-Console/ChromeLauncher/$port"
helper="$helper_dir/activate-bridge"
log_dir="$HOME/Library/Logs/LumOS1-Console"
lockfile="$agent_dir/.$label.lock"

/bin/launchctl print "$domain" >/dev/null 2>&1 || fail 'Mac にログインしたユーザーで実行してください。'
if [[ -L "$plist" || -L "$helper_dir" || -L "$helper" || -L "$lockfile" ]]; then
  fail "シンボリックリンクを含むインストール先を操作できません。$plist"
fi
/bin/mkdir -p "$agent_dir"
exec 9>>"$lockfile"
/usr/bin/lockf -t 10 9 || fail "別の起動設定処理が実行中です。$label"

existing=false
if [[ -e "$plist" ]]; then
  if [[ "$(/usr/libexec/PlistBuddy -c 'Print :Label' "$plist" 2>/dev/null)" != "$label" ||
        "$(/usr/libexec/PlistBuddy -c 'Print :ProgramArguments:0' "$plist" 2>/dev/null)" != "$helper" ]]; then
    fail "既存の設定ファイルを確認してください。$plist"
  fi
  existing=true
elif [[ -e "$helper" ]]; then
  fail "インストール先に既存ファイルがあります。$helper"
fi

loaded=false
if job_info="$(/bin/launchctl print "$job" 2>/dev/null)"; then
  if ! $existing || ! /usr/bin/grep -Fqx $'\tpath = '"$plist" <<< "$job_info"; then
    fail "同じ名前の起動設定が既に登録されています。$label"
  fi
  loaded=true
fi

if [[ "$action" == remove ]]; then
  if $loaded; then
    /bin/launchctl bootout "$job"
  fi
  if $existing; then
    /bin/rm -f "$plist" "$helper"
    /bin/rmdir "$helper_dir" 2>/dev/null || true
  fi
  printf 'Chrome アイコンの起動設定を解除しました。ポート %s\n' "$port"
  exit 0
fi

[[ -r "$bridge" && -r "$resources/public/index.html" ]] || fail "Mac アプリが見つかりません。$resources"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$PATH"
node_bin="$(command -v node || true)"
if [[ "$node_bin" != /* ]] || ! "$node_bin" -e 'process.exit(Number(process.versions.node.split(".")[0]) < 18 ? 1 : 0)'; then
  fail 'Node.js 18 以上をインストールしてください。'
fi

stage="$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/lumos1-chrome.XXXXXXXX")"
trap '/bin/rm -rf "$stage"' EXIT
/usr/bin/clang -Wall -Wextra -Werror -O2 "$root/tools/lumos1-mac/activate-bridge.c" -o "$stage/activate-bridge"
"$node_bin" - "$label" "$helper" "$node_bin" "$bridge" "$resources" "$log_dir" "$port" <<'NODE' > "$stage/agent.json"
const [Label, helper, node, bridge, WorkingDirectory, logs, port] = process.argv.slice(2);
const EnvironmentVariables = { BRIDGE_HOST: '127.0.0.1', BRIDGE_PORT: port };
for (const name of ['ROVER_HOST', 'ROVER_PORT']) {
  if (process.env[name]) EnvironmentVariables[name] = process.env[name];
}
console.log(JSON.stringify({
  Label,
  ProgramArguments: [helper, node, bridge],
  WorkingDirectory,
  EnvironmentVariables,
  ThrottleInterval: 1,
  Sockets: { HTTP: { SockNodeName: '127.0.0.1', SockServiceName: port, SockFamily: 'IPv4', SockType: 'stream' } },
  StandardOutPath: `${logs}/chrome-bridge-${port}.log`,
  StandardErrorPath: `${logs}/chrome-bridge-${port}.log`,
}));
NODE
/usr/bin/plutil -convert xml1 -o "$stage/agent.plist" "$stage/agent.json"

check_port() {
  "$node_bin" - "$port" <<'NODE'
const net = require('node:net');
const port = Number(process.argv[2]);
const probe = net.createServer();
probe.once('error', error => {
  console.error(`ポート ${port} を確保できません。${error.message}`);
  process.exitCode = 1;
});
probe.listen(port, '127.0.0.1', () => probe.close());
NODE
}

/bin/mkdir -p "$helper_dir" "$log_dir"
if $existing; then
  /bin/cp -p "$plist" "$stage/previous.plist"
  if [[ -f "$helper" ]]; then
    /bin/cp -p "$helper" "$stage/previous-helper"
  fi
fi
if $loaded; then
  /bin/launchctl bootout "$job"
fi

if check_port &&
   /usr/bin/install -m 755 "$stage/activate-bridge" "$helper" &&
   /usr/bin/install -m 644 "$stage/agent.plist" "$plist" &&
   /bin/launchctl bootstrap "$domain" "$plist"; then
  printf 'Chrome のアプリアイコンから起動できます。http://127.0.0.1:%s/\n' "$port"
  exit 0
fi

if [[ -f "$stage/previous.plist" ]]; then
  /bin/cp -p "$stage/previous.plist" "$plist"
  if [[ -f "$stage/previous-helper" ]]; then
    /bin/cp -p "$stage/previous-helper" "$helper"
  else
    /bin/rm -f "$helper"
  fi
  if $loaded; then
    /bin/launchctl bootstrap "$domain" "$plist" || fail "以前の起動設定を読み込み直してください。$plist"
  fi
else
  /bin/rm -f "$plist" "$helper"
  /bin/rmdir "$helper_dir" 2>/dev/null || true
fi
fail "Chrome アイコンの起動設定を登録できませんでした。ポート $port"
