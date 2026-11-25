#!/bin/sh
# Compile the design book to dist/srs.pdf. Pass --watch to rebuild on save.
set -eu
cd "$(dirname "$0")"

OUTPUT=../dist/srs.pdf
BRAND_FONTS=${SRS_FONT_PATH:-$HOME/.local/share/fonts/srs-brand}

mkdir -p ../dist

if [ ! -d "$BRAND_FONTS" ]; then
  echo "Brand fonts not found at $BRAND_FONTS" >&2
  echo "Install them there or set SRS_FONT_PATH to the font directory." >&2
  exit 1
fi

if command -v typst >/dev/null 2>&1; then
  if [ "${1:-}" = "--watch" ]; then
    exec typst watch --font-path "$BRAND_FONTS" index.typ "$OUTPUT"
  fi
  typst compile --font-path "$BRAND_FONTS" index.typ "$OUTPUT"
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import typst' 2>/dev/null; then
  python3 - "$BRAND_FONTS" "$OUTPUT" <<'PY'
import sys
import typst

typst.compile("index.typ", output=sys.argv[2], font_paths=[sys.argv[1]])
PY
else
  echo "typst is not installed. Install it from https://typst.app/open-source/" >&2
  echo "(or: cargo install typst-cli, brew install typst, pip install typst)." >&2
  exit 1
fi
echo "Wrote $(cd .. && pwd)/dist/srs.pdf"
