#!/bin/bash
cd "$HOME/telemetry-api" || exit 1

while true; do
    echo "[$(date -Is)] Starting telemetry API" >> supervisor.log
    "$HOME/nodejs/bin/node" index.js >> api.log 2>&1
    result=$?
    echo "[$(date -Is)] API exited ($result); restarting in 5 seconds" >> supervisor.log
    sleep 5
done
