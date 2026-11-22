#!/bin/bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

VERSION="${VERSION:-1.0.0~beta1}"
SRC_API="${SRC_API:-$ROOT/api}"
SRC_WEB="${SRC_WEB:-$ROOT}"
PACKAGING="${PACKAGING:-$HERE}"
OUT="${OUT:-$ROOT/build}"
PKG="mrps-telemetry"
ARCH="all"
STAGE="$OUT/${PKG}_${VERSION}_${ARCH}"
DEB="$OUT/${PKG}_${VERSION}_${ARCH}.deb"

if ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "dpkg-deb is required. Build this package on Debian/Ubuntu (or a container)." >&2
  exit 1
fi

if [ ! -d "$SRC_API/node_modules" ]; then
  echo "Missing $SRC_API/node_modules. Run: (cd \"$SRC_API\" && npm ci --omit=dev)" >&2
  exit 1
fi

if [ ! -f "$SRC_WEB/dist/index.html" ]; then
  echo "Missing $SRC_WEB/dist. Run: npm run build:server" >&2
  exit 1
fi

rm -rf "$STAGE"
mkdir -p \
  "$STAGE/DEBIAN" \
  "$STAGE/opt/$PKG/api" \
  "$STAGE/opt/$PKG/web" \
  "$STAGE/usr/lib/systemd/system" \
  "$STAGE/usr/bin" \
  "$STAGE/etc/default" \
  "$STAGE/usr/share/doc/$PKG"

# API (source + production dependencies)
for file in index.js collector.js api-contract.js discovery.js openapi.json package.json package-lock.json; do
  cp -a "$SRC_API/$file" "$STAGE/opt/$PKG/api/"
done
cp -a "$SRC_API/collectors" "$STAGE/opt/$PKG/api/collectors"
cp -a "$SRC_API/node_modules" "$STAGE/opt/$PKG/api/node_modules"

# Dashboard (static build + same-origin proxy)
cp -a "$SRC_WEB/dist" "$STAGE/opt/$PKG/web/dist"

# systemd units
cp -a "$PACKAGING/systemd/mrps-telemetry-api.service" "$STAGE/usr/lib/systemd/system/"

# Configuration
cp -a "$PACKAGING/default/mrps-telemetry-api" "$STAGE/etc/default/"

# CLI
cp -a "$PACKAGING/mrps-telemetry" "$STAGE/usr/bin/mrps-telemetry"
chmod 0755 "$STAGE/usr/bin/mrps-telemetry"

# Docs
if [ -f "$ROOT/README.md" ]; then
  cp -a "$ROOT/README.md" "$STAGE/usr/share/doc/$PKG/README.md"
fi
if [ -f "$ROOT/LICENSE" ]; then
  cp -a "$ROOT/LICENSE" "$STAGE/usr/share/doc/$PKG/LICENSE"
fi
cat > "$STAGE/usr/share/doc/$PKG/copyright" <<'EOF'
MRPS telemetry
Copyright (c) Mani Ratan Pratap Singh
Licensed under the MIT License.
EOF

# Maintainer scripts
cp -a "$PACKAGING/debian/postinst" "$STAGE/DEBIAN/postinst"
cp -a "$PACKAGING/debian/prerm" "$STAGE/DEBIAN/prerm"
cp -a "$PACKAGING/debian/postrm" "$STAGE/DEBIAN/postrm"
chmod 0755 "$STAGE/DEBIAN/postinst" "$STAGE/DEBIAN/prerm" "$STAGE/DEBIAN/postrm"

cat > "$STAGE/DEBIAN/conffiles" <<'EOF'
/etc/default/mrps-telemetry-api
EOF

SIZE="$(du -sk "$STAGE" | cut -f1)"
sed -e "s/@VERSION@/$VERSION/g" -e "s/@SIZE@/$SIZE/g" \
  "$PACKAGING/debian/control.in" > "$STAGE/DEBIAN/control"

mkdir -p "$OUT"
dpkg-deb --build --root-owner-group "$STAGE" "$DEB"

echo "built: $DEB"
dpkg-deb --info "$DEB" | sed -n '1,20p'
