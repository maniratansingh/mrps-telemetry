# MRPS Telemetry — v1.0.0 beta 1

One Debian package containing the read-only Linux telemetry API and the Liquid Glass
dashboard. Both run as systemd services on the same host; the browser only talks to
the dashboard origin.

## Assets

- `mrps-telemetry_1.0.0~beta1_all.deb` — API + dashboard + services + CLI
- `mrps-telemetry.asc` — public GPG key for the APT repository

## Install

```bash
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL http://<server-ip>:8090/mrps-telemetry.asc \
  | sudo gpg --dearmor -o /etc/apt/keyrings/mrps-telemetry.gpg

echo 'deb [signed-by=/etc/apt/keyrings/mrps-telemetry.gpg] http://<server-ip>:8090/ stable main' \
  | sudo tee /etc/apt/sources.list.d/mrps-telemetry.list

sudo apt update
sudo apt install mrps-telemetry
```

The package depends on `nodejs (>= 18)`.

If an older manual deployment still occupies the ports:

```bash
systemctl --user disable --now telemetry-dashboard
pkill -f 'telemetry-api/run-monitor.sh' || true
lsof -t -iTCP:43871 | xargs -r kill
```

Then:

```bash
mrps-telemetry status
mrps-telemetry url
```

## Chart and display fixes

- Removed per-frame SVG `d` interpolation; charts now update in discrete steps
  instead of morphing between shapes every 500 ms.
- CPU utilisation is measured over a 1-second window, so the monitor's own short
  bursts no longer create the "audio waveform" effect.
- 4K-ready layout: 3000 px working width, 18 px root type, taller charts and a
  wider hero; no horizontal overflow at 3840×2160.
- One process serves the dashboard and the API; the apt repository is a Go binary.

## Readiness, not guesswork

The dashboard's **System → System readiness** section lists every feature as
**Ready / Limited / Missing**, with the exact reason and a copyable remedy:

- Node.js runtime, CPU collector, GPU metrics
- SMART health and how many devices actually reported
- temperature and fan channels
- WireGuard and Tailscale, including permission failures
- optional tools (`smartctl`, `wg`, `tailscale`, `nvidia-smi`, `lspci`, `sensors`)

The same report is printed at install time and is always available:

```bash
mrps-telemetry doctor
```

No missing sensor, SMART device, GPU metric, peer or permission is silently shown
as zero.

## What is inside

- One process: API on `:43871` and dashboard on `:4310`, same origin, no proxy.
- GET-only JSON, SSE stream, 500 ms sampling.
- APT repository on `:8090` — signed `InRelease` / `Release.gpg`.
- Capability detection: platform/arch, Raspberry Pi model, CPU vendor and threads,
  GPU vendor/model/driver (NVIDIA first, DRM/PCI fallback), SMART tool and reported
  devices, sensors, fans, WireGuard, Tailscale and external tools.
- Radial gauges, storage rings, 60 s/120 s chart range, per-thread matrix.
- Read-only: no controls, no shell endpoints, no credential storage.
- No Python in production: the APT repository is served by a small Node static server.

## Notes

- APT repository key fingerprint:
  `3A0E9269EE9460C52A1F2C6B745A72BFF4F83637`
- The API service runs as root because SMART and WireGuard need it. Set
  `HOST=127.0.0.1` in `/etc/default/mrps-telemetry-api` if remote API access is not
  needed.
- WebSocket is intentionally not used. SSE delivers the same 500 ms push cadence with
  less protocol overhead, automatic reconnection and no proxy upgrade handling.
- This is a beta release of the V1 line.
