#!/bin/bash
set -u

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR" || exit 1

PORT="${PORT:-4310}"
PID_FILE="$DIR/dashboard.pid"
LOG_FILE="$DIR/dashboard.log"

export PATH="$HOME/nodejs/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "node not found (expected \$HOME/nodejs/bin/node)" >&2
  exit 1
fi

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "dashboard already running (pid $(cat "$PID_FILE")) on port $PORT"
  exit 0
fi

PORT="$PORT" setsid "$NODE" server/server.mjs >> "$LOG_FILE" 2>&1 < /dev/null &
echo $! > "$PID_FILE"
sleep 1

if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "dashboard started (pid $(cat "$PID_FILE")) on http://0.0.0.0:$PORT"
else
  echo "dashboard failed to start; last log lines:" >&2
  tail -n 20 "$LOG_FILE" >&2
  rm -f "$PID_FILE"
  exit 1
fi
