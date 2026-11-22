#!/bin/bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
ARCH="all"
PKG="mrps-telemetry"

DEB="${1:-$(ls -1 "$ROOT"/build/mrps-telemetry_*_"$ARCH".deb 2>/dev/null | sort | tail -n 1)}"
REPO="${2:-$ROOT/build/apt-repo}"

if [ -z "${DEB:-}" ] || [ ! -f "$DEB" ]; then
  echo "No .deb found. Build it first with packaging/build-deb.sh" >&2
  exit 1
fi

if ! command -v dpkg-scanpackages >/dev/null 2>&1; then
  echo "dpkg-scanpackages is required (install dpkg-dev)." >&2
  exit 1
fi

mkdir -p "$REPO/pool/main/m/$PKG" "$REPO/dists/stable/main/binary-$ARCH"
find "$REPO/pool/main/m/$PKG" -maxdepth 1 -name '*.deb' -delete
cp -f "$DEB" "$REPO/pool/main/m/$PKG/"

cd "$REPO"
dpkg-scanpackages --multiversion pool > "dists/stable/main/binary-$ARCH/Packages"
gzip -9kf "dists/stable/main/binary-$ARCH/Packages"

{
  echo "Origin: MRPS"
  echo "Label: MRPS Telemetry"
  echo "Suite: stable"
  echo "Codename: stable"
  echo "Architectures: $ARCH"
  echo "Components: main"
  echo "Description: Unofficial MRPS telemetry package repository"
  echo "Date: $(date -Ru)"
  echo "MD5Sum:"
  for file in "main/binary-$ARCH/Packages" "main/binary-$ARCH/Packages.gz"; do
    printf " %s %s %s\n" \
      "$(md5sum "dists/stable/$file" | cut -d' ' -f1)" \
      "$(stat -c%s "dists/stable/$file")" \
      "$file"
  done
  echo "SHA256:"
  for file in "main/binary-$ARCH/Packages" "main/binary-$ARCH/Packages.gz"; do
    printf " %s %s %s\n" \
      "$(sha256sum "dists/stable/$file" | cut -d' ' -f1)" \
      "$(stat -c%s "dists/stable/$file")" \
      "$file"
  done
} > "dists/stable/Release"

# Sign the repository metadata with the repository GPG key.
SIGNING_KEY="${SIGNING_KEY:-email@mrps.in}"
if gpg --batch --list-secret-keys "$SIGNING_KEY" >/dev/null 2>&1; then
  gpg --batch --yes --default-key "$SIGNING_KEY" --clearsign -o "dists/stable/InRelease" "dists/stable/Release"
  gpg --batch --yes --default-key "$SIGNING_KEY" --armor --detach-sign -o "dists/stable/Release.gpg" "dists/stable/Release"
  gpg --armor --export "$SIGNING_KEY" > mrps-telemetry.asc
  echo "signed with: $SIGNING_KEY"
else
  echo "WARNING: no GPG secret key found for $SIGNING_KEY; repository is unsigned" >&2
fi

chmod -R a+rX "$REPO"

echo "apt repository: $REPO"
echo
echo "Add it on a client:"
echo "  curl -fsSL http://<server-ip>:8090/mrps-telemetry.asc | sudo gpg --dearmor -o /etc/apt/keyrings/mrps-telemetry.gpg"
echo "  echo 'deb [signed-by=/etc/apt/keyrings/mrps-telemetry.gpg] http://<server-ip>:8090/ stable main' | sudo tee /etc/apt/sources.list.d/mrps-telemetry.list"
echo "  sudo apt update && sudo apt install mrps-telemetry"
