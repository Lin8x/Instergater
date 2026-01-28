#!/bin/bash
# Version update script for Instergater
# Usage: ./update-version.sh <new_version>
# Example: ./update-version.sh 1.3

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if version argument provided
if [ -z "$1" ]; then
    echo "Usage: $0 <new_version>"
    echo "Example: $0 1.3"
    echo ""
    # Show current versions
    echo "Current versions:"
    echo "  manifest.json:         $(grep -o '"version": "[^"]*"' "$SCRIPT_DIR/manifest.json" | head -1)"
    echo "  manifest.firefox.json: $(grep -o '"version": "[^"]*"' "$SCRIPT_DIR/manifest.firefox.json" | head -1)"
    echo "  README.md badge:       $(grep -o 'version-[0-9.]*-' "$SCRIPT_DIR/README.md" | head -1 | sed 's/version-//;s/-$//')"
    exit 1
fi

NEW_VERSION="$1"

# Validate version format (basic check for semver-like: 1.0, 1.0.0, 2.1.3, etc.)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
    echo "Error: Invalid version format '$NEW_VERSION'"
    echo "Expected format: X.Y or X.Y.Z (e.g., 1.2 or 1.2.3)"
    exit 1
fi

echo "Updating version to $NEW_VERSION..."

# Update manifest.json
if [ -f "$SCRIPT_DIR/manifest.json" ]; then
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$SCRIPT_DIR/manifest.json"
    echo "  ✓ manifest.json"
fi

# Update manifest.firefox.json
if [ -f "$SCRIPT_DIR/manifest.firefox.json" ]; then
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$SCRIPT_DIR/manifest.firefox.json"
    echo "  ✓ manifest.firefox.json"
fi

# Update README.md version badge
if [ -f "$SCRIPT_DIR/README.md" ]; then
    sed -i "s/version-[0-9.]*-blue/version-$NEW_VERSION-blue/" "$SCRIPT_DIR/README.md"
    echo "  ✓ README.md"
fi

echo ""
echo "Version updated to $NEW_VERSION"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Rebuild: ./build.sh"
echo "  3. Commit: git add -A && git commit -m 'Bump version to $NEW_VERSION'"
