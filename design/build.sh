#!/bin/sh
# Compile the astro-ssg design book to ../dist/astro-ssg-design.pdf.
# Pass --watch to rebuild on save.
set -eu

cd "$(dirname "$0")"

OUTPUT=../dist/astro-ssg-design.pdf
mkdir -p ../dist

if command -v typst >/dev/null 2>&1; then
  if [ "${1:-}" = "--watch" ]; then
    exec typst watch index.typ "$OUTPUT"
  fi
  typst compile index.typ "$OUTPUT"
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import typst' 2>/dev/null; then
  python3 - "$OUTPUT" <<'PY'
import sys
import typst

typst.compile("index.typ", output=sys.argv[1])
PY
else
  echo "typst is not installed. Install it from https://typst.app/open-source/" >&2
  echo "(or: cargo install typst-cli, brew install typst, pip install typst)." >&2
  exit 1
fi

echo "Wrote $(cd .. && pwd)/dist/astro-ssg-design.pdf"
