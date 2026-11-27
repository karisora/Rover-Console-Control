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
#     LumOS1-Console.app    ← ダブルクリック起動
#     start.command        ← Terminal で起動
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

# ランチャー、ブリッジ、UI をコピー
TEMPLATE_DIR="$SCRIPT_DIR/lumos1-mac"
install -m 755 "$TEMPLATE_DIR/$APP_NAME" "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
install -m 755 "$TEMPLATE_DIR/launch-console.sh" "$APP_BUNDLE/Contents/Resources/launch-console.sh"
install -m 755 "$TEMPLATE_DIR/start.command" "$PKG_DIR/start.command"
cp "$TEMPLATE_DIR/README.txt" "$PKG_DIR/README.txt"
cp "$SCRIPT_DIR/rover-bridge.mjs" "$APP_BUNDLE/Contents/Resources/rover-bridge.mjs"
cp -R "$ROOT_DIR/artifacts/rover-console/dist/public" "$APP_BUNDLE/Contents/Resources/public"

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
