# MRPS Telemetry

**V1 beta** — release `v1.0.0-beta.1`. The Debian package version is `1.0.0~beta1`.

A single, self-contained Linux telemetry product: a read-only collector/API and a
Liquid Glass dashboard, installed as **one `.deb` package** and run as **one systemd service** and
**one process** on the same machine.

- API and dashboard install together, start together, and talk over loopback.
- The API process also serves the dashboard on the same origin, so `/api/*` needs no proxy, no CORS configuration and no second service.
- Live updates use **Server-Sent Events** (SSE) pushed twice per second, with HTTP
  polling as an automatic fallback.
- Everything is read-only. There are no control actions, no shell endpoints, no
  credential storage, and no simulated values.

```
browser ──HTTP──► one process :4310 (dashboard + /api/v1/*)
                          │
                          └── :43871 (API, same process)
                                /proc, /sys, smartctl, wg, tailscale, nvidia-smi
```

## Install

The unofficial APT repository is served from the same server:

```bash
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL http://<server-ip>:8090/mrps-telemetry.asc \
  | sudo gpg --dearmor -o /etc/apt/keyrings/mrps-telemetry.gpg

echo 'deb [signed-by=/etc/apt/keyrings/mrps-telemetry.gpg] http://<server-ip>:8090/ stable main' \
  | sudo tee /etc/apt/sources.list.d/mrps-telemetry.list

sudo apt update
sudo apt install mrps-telemetry
```

The repository is signed with the dedicated `MRPS Telemetry Repository
<email@mrps.in>` key (fingerprint
`3A0E9269EE9460C52A1F2C6B745A72BFF4F83637`). APT rejects any package whose
hash is not covered by that signature.

The package depends on `nodejs (>= 18)`; APT installs it if it is missing.

If an older manual deployment is still occupying ports 4310/43871, stop it first
(no sudo needed for the user services):

```bash
systemctl --user disable --now telemetry-dashboard
pkill -f 'telemetry-api/run-monitor.sh' || true
lsof -t -iTCP:43871 | xargs -r kill
```

After install:

```bash
mrps-telemetry status      # both services
mrps-telemetry url         # dashboard URL for this host
mrps-telemetry logs        # follow journal
mrps-telemetry restart
```

## Capability detection

At startup the API probes the machine and reports a capabilities object with the
host response:

- platform (x86_64 / arm64, Linux, Raspberry Pi model from device tree)
- CPU vendor, model, physical cores and logical threads
- GPU presence, vendor, model and driver, using `nvidia-smi` first and DRM/PCI
  detection as the fallback
- SMART tool availability and how many devices actually reported
- thermal sensors and fans
- WireGuard and Tailscale presence and state
- every external tool it will use (`nvidia-smi`, `smartctl`, `wg`, `tailscale`,
  `lspci`, `lsblk`, `sensors`)

The dashboard renders these as a detected-capabilities strip and labels missing
hardware explicitly — it never invents values for a GPU, sensor or SMART device it
cannot read.

## What it monitors

| Section | Source | Notes |
| --- | --- | --- |
| CPU | `/proc/stat`, `/proc/cpuinfo` | per-core and per-thread, any core count |
| Memory | `/proc/meminfo` | used, cached, buffers, swap |
| GPU | `nvidia-smi` + DRM/PCI detection | vendor is detected; non-NVIDIA adapters are labelled instead of faked |
| Thermal | `/sys/class/hwmon`, `thermal_zone` | only reported sensors |
| Storage / SMART | `lsblk`, `smartctl` | per-device health, no invented attributes |
| Disk I/O | `/proc/diskstats` | instantaneous rates and IOPS |
| Network | `/proc/net/dev`, interfaces | per-interface rates, errors, drops |
| Processes | `ps` | top processes, sortable |
| WireGuard / Tailscale | `wg`, `tailscale status` | peer identities and keys are never exposed |
| System | DMI, kernel, uptime | host facts and telemetry provenance |

The API samples twice per second. The dashboard receives each new sample over SSE,
and falls back to 500 ms polling if the stream is unavailable. History covers the
API's in-memory 120-second window.

## Configuration

`/etc/default/mrps-telemetry-api`

```ini
PORT=43871
HOST=0.0.0.0
```

`/etc/default/mrps-telemetry-web`

```ini
PORT=4310
API_ORIGIN=http://127.0.0.1:43871
```

Restart the relevant service after editing. For a single-host deployment, setting
`HOST=127.0.0.1` closes the API to the network while keeping the dashboard proxy
working.

## Dependencies and readiness

Required: `nodejs (>= 18)`.

Optional, feature-by-feature:

| Feature | Needs | If missing |
| --- | --- | --- |
| SMART health | `smartctl` (`smartmontools`) | SMART marked missing with the install command |
| WireGuard | `wg` (`wireguard-tools`) + privilege | "Limited" with permission or config reason |
| Tailscale | `tailscale` | "Missing" with the setup hint |
| GPU metrics | NVIDIA driver / `nvidia-smi` | Vendor detected, metrics labeled unavailable |
| Sensors / fans | hwmon drivers, `lm-sensors` | "No sensors exposed" with driver hint |
| GPU model names | `lspci` (`pciutils`) | Generic vendor name instead of a model |

```bash
sudo apt install smartmontools wireguard-tools lm-sensors pciutils
```

The dashboard's **System → System readiness** section lists every check as
**Ready / Limited / Missing**, with the exact reason and a copyable remedy. The
package prints the same report at install time, and it is always available as:

```bash
mrps-telemetry doctor
```

Nothing is silently zeroed: a missing sensor, SMART device, GPU metric, peer or
permission is shown as unavailable with its cause.

## Build from source

Requirements: Node.js 22+, npm, and a Debian/Ubuntu host with `dpkg-deb` and
`dpkg-scanpackages` for packaging.

```bash
npm install
npm run build:server          # static dashboard, same-origin API mode

cd api && npm ci --omit=dev && cd ..

packaging/build-deb.sh        # produces build/mrps-telemetry_<version>_all.deb
packaging/build-apt-repo.sh   # produces build/apt-repo/
```

Serve `build/apt-repo/` over HTTP and point APT at it. `build-apt-repo.sh`
re-signs `Release` with the repository GPG key and exports the public key as
`mrps-telemetry.asc` on every rebuild. Replace the key with your own before
redistributing the repo publicly.

## Repository layout

```
api/          collector + HTTP API + static dashboard (one process)
src/          dashboard source (React + Vite)
packaging/    Debian control files, systemd unit, build scripts, Go apt repo
src/styles/  Liquid Glass design tokens and dashboard CSS
```

## Security

- GET-only API; the rate limiter exempts loopback so the dashboard proxy never
  throttles itself.
- No authentication is built in. Bind the API to `127.0.0.1` unless you need
  remote API access.
- Peer identities, endpoints, and keys are never included in the payload.
- The web service runs as a dynamic user with `ProtectSystem=strict`; the API
  service runs as root only because SMART and WireGuard collection require it.

## Credits

Designed and built by **Mani Ratan Pratap Singh** (MRPS) — <https://mrps.in>.
The Liquid Glass visual system is shared with the mrps.in site theme.

## License

MIT — see [LICENSE](LICENSE).
