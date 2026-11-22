#!/bin/bash
set -eu

DIR="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"

mkdir -p "$UNIT_DIR"
cp "$DIR/scripts/telemetry-dashboard.service" "$UNIT_DIR/telemetry-dashboard.service"

systemctl --user daemon-reload
systemctl --user enable --now telemetry-dashboard.service
sleep 1

echo "--- service status ---"
systemctl --user --no-pager --lines=0 status telemetry-dashboard.service
echo "--- no sudo required; this is a user service ---"
echo "logs: journalctl --user -u telemetry-dashboard -f"
