# MRPS telemetry dashboard — server deployment

This directory is a self-contained deployment: static dashboard + a zero-dependency
Node server that also proxies the telemetry API on the same origin.

## Layout

```
dist/                         built dashboard (static)
server/server.mjs             static server + /api proxy
scripts/start.sh              run in background (no systemd)
scripts/stop.sh               stop the background process
scripts/install-service.sh    install + enable the systemd user service
scripts/telemetry-dashboard.service
dashboard.log                 runtime log (start.sh mode)
```

## How it runs

- Dashboard: `http://<server-ip>:4310`
- API proxy: `http://<server-ip>:4310/api/v1/...` → `http://127.0.0.1:43871/api/v1/...`
- Because the browser talks to the same origin, there is no CORS or mixed-content issue.
- The API is read-only and never modified by this service.

## Service (recommended)

Already enabled as a systemd **user** service; no sudo is used.

```bash
systemctl --user status telemetry-dashboard
systemctl --user restart telemetry-dashboard
journalctl --user -u telemetry-dashboard -f
```

Linger is enabled for the `monitor` user, so the service starts at boot and keeps
running without an open login session.

## Updating

From the project on the Mac:

```bash
npm run build
rsync -az -e "ssh -S ~/.ssh/<control-socket>" dist server scripts \
  <user>@<server>:~/telemetry-dashboard/
ssh -S ~/.ssh/<control-socket> <user>@<server> \
  'systemctl --user restart telemetry-dashboard'
```

## Ad-hoc mode

```bash
cd ~/telemetry-dashboard
PORT=4310 ./scripts/start.sh
./scripts/stop.sh
```

Do not run both modes at once; they share port 4310.

## Notes

- Polling is 1s, matching the API collector's 1s sample interval.
- API requests are proxied from the dashboard server, so all viewers share the
  API's 120 requests/minute localhost allowance. One dashboard uses ~60/min.
- If the API restarts, the dashboard shows a delayed/stale state and recovers
  automatically; the API's in-memory history resets on restart.
