#!/bin/bash
set -u

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$DIR/dashboard.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "dashboard is not running (no pid file)"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$PID" 2>/dev/null || break
    sleep 0.3
  done
  if kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID"
  fi
  echo "dashboard stopped (pid $PID)"
else
  echo "dashboard was not running (stale pid $PID)"
fi

rm -f "$PID_FILE"
