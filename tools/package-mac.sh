#!/usr/bin/env bash
# ============================================================
#  LUMOS-1 Rover Console — Mac パッケージビルドスクリプト
# ============================================================
#
# 使い方:
#   chmod +x tools/package-mac.sh
#   ./tools/package-mac.sh
#
# 出力: dist-mac/lumos1-console-mac.tar.gz
#
# tar.gz を展開すると:
#   lumos1-console-mac/
#     LumOS1-Console.app   ← .app ダブルクリック起動（初回は右クリック→開く）
#     start.command        ← Gatekeeper 回避用 確実な起動方法
#     README.txt
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$ROOT_DIR/dist-mac"
APP_NAME="LumOS1-Console"
PKG_DIR="$DIST_DIR/lumos1-console-mac"
APP_BUNDLE="$PKG_DIR/$APP_NAME.app"
ARCHIVE="$DIST_DIR/lumos1-console-mac.tar.gz"

echo ""
echo "=========================================="
echo "  LUMOS-1 Rover Console — Mac Build"
echo "=========================================="
echo ""

# ── 1. Vite ビルド ───────────────────────────────────────────
echo "[1/5] Rover Console (Vite) をビルド中..."
cd "$ROOT_DIR"
PORT=5050 BASE_PATH=/ pnpm --filter @workspace/rover-console run build
echo "      → artifacts/rover-console/dist/public/ 完了"

# ── 2. ディレクトリ初期化 ─────────────────────────────────────
echo "[2/5] パッケージディレクトリを構成中..."
rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR"

# ── 3. .app バンドル ─────────────────────────────────────────
# macOS .app 構造:
#   LumOS1-Console.app/
#     Contents/
#       Info.plist
#       MacOS/LumOS1-Console   ← 実行シェルスクリプト
#       Resources/
#         rover-bridge.mjs
#         public/
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>LumOS1-Console</string>
  <key>CFBundleIdentifier</key>
  <string>jp.lumos1.rover-console</string>
  <key>CFBundleName</key>
  <string>LumOS1-Console</string>
  <key>CFBundleDisplayName</key>
  <string>LUMOS-1 Rover Console</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.15</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

# Contents/MacOS/ 実行スクリプト
# ★ 重要: shebang (#!) は必ずファイル先頭バイト 0 から始まること
# 先頭に空行があると macOS は shebang を認識せずバイナリ扱いし、
# "このMacには対応していないため開けません" エラーになる
cat > "$APP_BUNDLE/Contents/MacOS/$APP_NAME" << 'LAUNCHER'
#!/bin/bash
# LUMOS-1 Rover Console — macOS launcher

# --- Node.js の検索 ---
NODE_BIN=""
for candidate in \
  /usr/local/bin/node \
  /opt/homebrew/bin/node \
  "$HOME/.volta/bin/node"
do
  if [ -x "$candidate" ]; then
    NODE_BIN="$candidate"
    break
  fi
done

if [ -z "$NODE_BIN" ] && [ -d "$HOME/.nvm/versions/node" ]; then
  NVM_LATEST=$(ls "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)
  if [ -n "$NVM_LATEST" ] && [ -x "$HOME/.nvm/versions/node/$NVM_LATEST/bin/node" ]; then
    NODE_BIN="$HOME/.nvm/versions/node/$NVM_LATEST/bin/node"
  fi
fi

if [ -z "$NODE_BIN" ]; then
  export PATH="/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
  NODE_BIN=$(command -v node 2>/dev/null || true)
fi

if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  /usr/bin/osascript -e 'display alert "Node.js が見つかりません" message "LUMOS-1 Rover Console には Node.js が必要です。https://nodejs.org からインストールしてください。" as critical buttons {"OK"} default button "OK"'
  exit 1
fi

# --- Resources の場所を解決 ---
CONTENTS="$(cd "$(dirname "$0")/.." && pwd)"
RESOURCES="$CONTENTS/Resources"
BRIDGE="$RESOURCES/rover-bridge.mjs"

# --- ログファイルの準備 ---
LOG_DIR="$HOME/Library/Logs/LumOS1-Console"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/bridge.log"

# --- ポート 5050 を解放 ---
if /usr/sbin/lsof -ti :5050 >/dev/null 2>&1; then
  /usr/sbin/lsof -ti :5050 | xargs kill -TERM 2>/dev/null || true
  sleep 0.8
fi

# --- ブリッジをバックグラウンド起動 (Terminal は開かない) ---
# nohup + disown で .app の launcher プロセス終了後も生存させる
# 出力は ~/Library/Logs/LumOS1-Console/bridge.log に追記
{
  echo ""
  echo "================================================"
  echo "  LUMOS-1 Bridge starting at $(date)"
  echo "  PID will be written below"
  echo "================================================"
} >> "$LOG_FILE"

nohup "$NODE_BIN" "$BRIDGE" >> "$LOG_FILE" 2>&1 < /dev/null &
BRIDGE_PID=$!
disown $BRIDGE_PID 2>/dev/null || true

echo "Bridge PID: $BRIDGE_PID" >> "$LOG_FILE"

# --- ブラウザを開く (サーバー起動を 2 秒待つ) ---
sleep 2
/usr/bin/open "http://127.0.0.1:5050"

# launcher は即座に終了 (Dock からアプリが消える)
exit 0
LAUNCHER

chmod +x "$APP_BUNDLE/Contents/MacOS/$APP_NAME"

# 検証: shebang が先頭バイト 0 から始まっているか確認
FIRST_BYTES=$(head -c 2 "$APP_BUNDLE/Contents/MacOS/$APP_NAME")
if [ "$FIRST_BYTES" != "#!" ]; then
  echo "❌ FATAL: launcher script does not start with #! shebang"
  echo "   First bytes: $(head -c 10 "$APP_BUNDLE/Contents/MacOS/$APP_NAME" | od -c | head -1)"
  exit 1
fi
echo "      ✓ launcher shebang verified at byte 0"

# Resources にブリッジと UI をコピー
cp "$SCRIPT_DIR/rover-bridge.mjs" "$APP_BUNDLE/Contents/Resources/rover-bridge.mjs"
cp -r "$ROOT_DIR/artifacts/rover-console/dist/public" "$APP_BUNDLE/Contents/Resources/public"

# ── 4. start.command (Gatekeeper を完全に回避できる起動方法) ──
# .command ファイルは Finder でダブルクリックすると Terminal が開く
# macOS 標準の動作で、.app バンドルの Gatekeeper チェックを受けない
cat > "$PKG_DIR/start.command" << 'CMD'
#!/usr/bin/env bash
# LUMOS-1 Rover Console — start.command
# Finder でダブルクリックすると Terminal が開いてブリッジが起動します

# --- Node.js の検索 ---
export PATH="/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

for candidate in \
  /usr/local/bin/node \
  /opt/homebrew/bin/node \
  "$HOME/.volta/bin/node"
do
  [ -x "$candidate" ] && export PATH="$(dirname "$candidate"):$PATH" && break
done

if ! command -v node &>/dev/null; then
  echo "❌ Node.js が見つかりません。https://nodejs.org からインストールしてください。"
  echo "   このウィンドウを閉じてインストール後に再度お試しください。"
  read -rp "Press Enter to close..."
  exit 1
fi

echo "✓ Node.js $(node --version)"
echo ""

# ブリッジの場所 = このスクリプトと同じディレクトリ内の .app
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE="$SCRIPT_DIR/LumOS1-Console.app/Contents/Resources/rover-bridge.mjs"

if [ ! -f "$BRIDGE" ]; then
  echo "❌ rover-bridge.mjs が見つかりません: $BRIDGE"
  read -rp "Press Enter to close..."
  exit 1
fi

# ポート 5050 を解放
if lsof -ti :5050 &>/dev/null 2>&1; then
  echo "⚠ ポート 5050 使用中 — 既存プロセスを停止します..."
  lsof -ti :5050 | xargs kill -TERM 2>/dev/null || true
  sleep 0.8
fi

echo "=========================================="
echo "  LUMOS-1 Rover Bridge 起動中..."
echo "  http://127.0.0.1:5050"
echo "=========================================="
echo "  ローバー Wi-Fi AP (LumOS1-Pico2W) に"
echo "  このMacが接続されているか確認してください"
echo "=========================================="
echo ""

# 2秒後にブラウザを開く (バックグラウンドで)
(sleep 2 && open "http://127.0.0.1:5050") &

# ブリッジ起動 (フォアグラウンド — Ctrl+C で停止)
exec node "$BRIDGE"
CMD
chmod +x "$PKG_DIR/start.command"

# ── 5. README.txt ────────────────────────────────────────────
cat > "$PKG_DIR/README.txt" << 'README'
LUMOS-1 Rover Console — Mac パッケージ
=======================================

起動方法 (2通り)
-----------------

【方法 A — start.command (推奨・確実)】
  start.command をダブルクリック
  → Terminal が開きブリッジが起動
  → ブラウザで http://127.0.0.1:5050 が自動オープン
  ※ Gatekeeper の制限なし

【方法 B — LumOS1-Console.app】
  初回のみ: 右クリック → "開く" → "開く" を選択
  2回目以降: ダブルクリックで起動
  ※ 初回ダブルクリックで "アクセス権がありません" と出た場合は
     ターミナルで以下を実行:
     xattr -rd com.apple.quarantine LumOS1-Console.app

前提条件
--------
  - macOS 10.15 (Catalina) 以降
  - Node.js 18 以上 (https://nodejs.org)
  - ローバーの Wi-Fi AP (SSID: LumOS1-Pico2W) に接続済みであること

使い方
------
  1. Mac を LumOS1-Pico2W Wi-Fi AP に接続する
  2. start.command またはアプリを起動する
  3. ブラウザで http://127.0.0.1:5050 が開く
  4. BRIDGE URL 欄に http://127.0.0.1:5050 を設定する
  5. ローバーを操作する

ブリッジの動作 (.app 起動時)
----------------------------
  Terminal ウィンドウは開きません。バックグラウンドで動作します。
  ログは下記ファイルに追記されます:
    ~/Library/Logs/LumOS1-Console/bridge.log
  リアルタイム表示:
    tail -f ~/Library/Logs/LumOS1-Console/bridge.log

停止方法
--------
  方法 1) ターミナルで:
    lsof -ti :5050 | xargs kill
  方法 2) Web コンソール画面右上の SHUTDOWN ボタン
  方法 3) アクティビティモニタで "node" を検索して終了
  ※ start.command で起動した場合は Ctrl+C でも停止できます
README

echo "[3/5] .app / start.command / README.txt を生成完了"

# ── 6. tar.gz 作成 ───────────────────────────────────────────
echo "[4/5] tar.gz を作成中..."
cd "$DIST_DIR"
tar \
  --exclude="*.DS_Store" \
  --exclude="__MACOSX" \
  -czf "$ARCHIVE" \
  "lumos1-console-mac"

ARCHIVE_SIZE=$(du -sh "$ARCHIVE" | cut -f1)

echo "[5/5] 完了!"
echo ""
echo "=========================================="
echo "  出力: $ARCHIVE"
echo "  サイズ: $ARCHIVE_SIZE"
echo ""
echo "  展開すると lumos1-console-mac/ が現れます:"
echo "    LumOS1-Console.app  ← .app"
echo "    start.command       ← ダブルクリック確実起動"
echo "    README.txt"
echo "=========================================="
echo ""
