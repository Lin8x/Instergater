#!/bin/bash
# Build script for Instergater - creates platform-specific builds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

# Extract version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' "$SCRIPT_DIR/manifest.json" | head -1 | sed 's/"version": "//;s/"//')
if [ -z "$VERSION" ]; then
    echo "Error: Could not extract version from manifest.json"
    exit 1
fi

# Clean and create build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/chrome" "$BUILD_DIR/firefox"

# Files to include in both builds (exclude development/build files)
FILES=(
    "background.js"
    "browser-polyfill.js"
    "content.js"
    "content.css"
    "inject.js"
    "popup.html"
    "popup.js"
    "popup.css"
    "assets"
    "icons"
)

echo "Building Instergater v$VERSION..."

# Chrome build (uses manifest.json as-is)
echo "  → Chrome/Chromium (MV3)..."
for file in "${FILES[@]}"; do
    if [ -e "$SCRIPT_DIR/$file" ]; then
        cp -r "$SCRIPT_DIR/$file" "$BUILD_DIR/chrome/"
    fi
done
cp "$SCRIPT_DIR/manifest.json" "$BUILD_DIR/chrome/manifest.json"

# Firefox build (uses manifest.firefox.json renamed to manifest.json)
echo "  → Firefox (MV2)..."
for file in "${FILES[@]}"; do
    if [ -e "$SCRIPT_DIR/$file" ]; then
        cp -r "$SCRIPT_DIR/$file" "$BUILD_DIR/firefox/"
    fi
done
cp "$SCRIPT_DIR/manifest.firefox.json" "$BUILD_DIR/firefox/manifest.json"

# Create zip files for distribution
echo "  → Creating distribution archives..."
cd "$BUILD_DIR/chrome" && zip -r "../instergater-v${VERSION}-chrome.zip" . -x "*.DS_Store" > /dev/null
cd "$BUILD_DIR/firefox" && zip -r "../instergater-v${VERSION}-firefox.zip" . -x "*.DS_Store" > /dev/null

echo ""
echo "Build complete!"
echo "  Chrome:  $BUILD_DIR/instergater-v${VERSION}-chrome.zip"
echo "  Firefox: $BUILD_DIR/instergater-v${VERSION}-firefox.zip"
echo ""
echo "For manual loading:"
echo "  Chrome:  Load '$BUILD_DIR/chrome' as unpacked extension"
echo "  Firefox: Load '$BUILD_DIR/firefox/manifest.json' in about:debugging"
