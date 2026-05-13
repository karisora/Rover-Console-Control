#!/usr/bin/env bash
# Build a clickable macOS .app for Rover Console.
#
# Usage:
#   ./tools/package-mac.sh
#
# Output:
#   dist-mac/rover-console-mac/Rover Console.app
#   dist-mac/rover-console-mac.tar.gz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$ROOT_DIR/dist-mac"
PKG_DIR="$DIST_DIR/rover-console-mac"
APP_NAME="Rover Console"
APP_BUNDLE="$PKG_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
BRIDGE_DIR="$RESOURCES_DIR/bridge"
ARCHIVE="$DIST_DIR/rover-console-mac.tar.gz"

echo ""
echo "=========================================="
echo "  Rover Console - Mac App Build"
echo "=========================================="
echo ""

command -v pnpm >/dev/null 2>&1 || {
  echo "ERROR: pnpm was not found. Install pnpm, then rerun this script." >&2
  exit 1
}

command -v node >/dev/null 2>&1 || {
  echo "ERROR: Node.js was not found. Install Node.js 18 or newer, then rerun this script." >&2
  exit 1
}

echo "[1/5] Installing workspace dependencies..."
cd "$ROOT_DIR"
CI=true pnpm install --ignore-scripts --no-frozen-lockfile

echo "[2/5] Building Rover Console web UI..."
PORT=5050 BASE_PATH=/ pnpm --filter @workspace/rover-console run build

echo "[3/5] Creating .app bundle..."
rm -rf "$PKG_DIR"
mkdir -p "$MACOS_DIR" "$BRIDGE_DIR"

cp "$SCRIPT_DIR/mac-app/Info.plist" "$CONTENTS_DIR/Info.plist"
cp "$SCRIPT_DIR/mac-app/RoverConsole" "$MACOS_DIR/RoverConsole"
chmod +x "$MACOS_DIR/RoverConsole"

cp "$SCRIPT_DIR/rover-bridge.mjs" "$BRIDGE_DIR/rover-bridge.mjs"
cp -R "$ROOT_DIR/artifacts/rover-console/dist/public" "$BRIDGE_DIR/public"

if [ "$(head -c 2 "$MACOS_DIR/RoverConsole")" != "#!" ]; then
  echo "ERROR: launcher script does not start with a shebang." >&2
  exit 1
fi

echo "[4/5] Writing README..."
cat > "$PKG_DIR/README.txt" <<'README'
Rover Console - Mac App
=======================

起動方法
--------
Rover Console.app をダブルクリックしてください。

起動すると、アプリ内に同梱されたローカル bridge が立ち上がり、
ブラウザで Rover Console が自動的に開きます。

初回起動で macOS に止められる場合
---------------------------------
未署名のローカルアプリなので、初回だけ以下のどちらかを使ってください。

1. Rover Console.app を右クリックして「開く」を選ぶ
2. それでも開けない場合は、このフォルダで以下を実行する

   xattr -rd com.apple.quarantine "Rover Console.app"

必要なもの
----------
- macOS 10.15 以降
- Node.js 18 以上

ローバー実機を操作する場合
--------------------------
Mac を LumOS1-Pico2W Wi-Fi AP に接続してからアプリを起動してください。

ログ
----
~/Library/Logs/RoverConsole/rover-console.log

停止
----
Web コンソール右上の SHUTDOWN ボタンで bridge を停止できます。
README

echo "[5/5] Creating archive..."
mkdir -p "$DIST_DIR"
rm -f "$ARCHIVE"
(
  cd "$DIST_DIR"
  tar --exclude="*.DS_Store" --exclude="__MACOSX" -czf "$ARCHIVE" "rover-console-mac"
)

ARCHIVE_SIZE="$(du -sh "$ARCHIVE" | cut -f1)"

echo ""
echo "Done."
echo "App:     $APP_BUNDLE"
echo "Archive: $ARCHIVE ($ARCHIVE_SIZE)"
echo ""
echo "Open with:"
echo "  open \"$APP_BUNDLE\""
echo ""
