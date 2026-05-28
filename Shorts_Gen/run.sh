#!/bin/bash
# ⚽ Football Viral Shorts Generator – Launcher
# Run from any terminal: bash run.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "⚽ Football Viral Shorts Generator"
echo "──────────────────────────────────"

# Check Python 3
if ! command -v python3 &>/dev/null; then
  echo "❌  Python 3 not found. Please install Python 3.9+"
  exit 1
fi

# Install dependencies if needed
echo "🔧 Checking dependencies…"
python3 -m pip install moviepy opencv-python numpy scipy --break-system-packages -q 2>/dev/null || \
python3 -m pip install moviepy opencv-python numpy scipy -q 2>/dev/null || true

echo "✅ Dependencies ready!"
echo ""
echo "🚀 Launching app…"
python3 "$SCRIPT_DIR/app.py"
