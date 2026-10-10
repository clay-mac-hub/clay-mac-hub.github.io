#!/bin/sh
# make_icons.sh — turns icons/icon.svg into the PNG icons the app uses.
# Run it from the project folder after changing the icon drawing:
#
#     sh tools/make_icons.sh
#
# Uses two tools built into macOS: qlmanage (draws the SVG as a picture)
# and sips (resizes pictures).

set -e
cd "$(dirname "$0")/.."

TMP=$(mktemp -d)
qlmanage -t -s 1024 -o "$TMP" icons/icon.svg > /dev/null 2>&1
BIG="$TMP/icon.svg.png"

sips -z 180 180 "$BIG" --out icons/apple-touch-icon.png > /dev/null   # iPhone Home Screen
sips -z 192 192 "$BIG" --out icons/icon-192.png > /dev/null           # Android / manifest
sips -z 512 512 "$BIG" --out icons/icon-512.png > /dev/null           # large / splash
sips -z 32 32   "$BIG" --out icons/favicon.png > /dev/null            # browser tab

rm -rf "$TMP"
echo "Icons updated in icons/"
