import { LockKeyhole } from "lucide-react";
import type { Snapshot } from "@/lib/telemetry/types";
import { formatBytes, formatHandshakeAge, formatNumber } from "@/lib/telemetry/format";
import { TelemetryPanel } from "@/components/telemetry/TelemetryPanel";
import { EmptyState, Stat } from "@/components/telemetry/TelemetryBits";

export function VpnPanel({ snapshot }: { snapshot: Snapshot }) {
  const wireguard = snapshot.wireguard;
  const tailscale = snapshot.tailscale;

  const totalRx = wireguard.interfaces.reduce(
    (total, entry) => total + entry.peers.reduce((sum, peer) => sum + peer.transfer.receivedBytes, 0),
    0,
  );
  const totalTx = wireguard.interfaces.reduce(
    (total, entry) => total + entry.peers.reduce((sum, peer) => sum + peer.transfer.sentBytes, 0),
    0,
  );
  const latestHandshake = wireguard.interfaces
    .flatMap((entry) => entry.peers.map((peer) => peer.latestHandshakeSecondsAgo))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)[0];

  return (
    <TelemetryPanel
      id="vpn"
      index="09"
      title="Secure Links"
      subtitle="WireGuard and Tailscale status"
      meta={<span className="tm-panel-current tm-mono">{wireguard.interfaces[0]?.name ?? "—"}</span>}
    >
      <div className="tm-vpn-block">
        <div className="tm-subsection-head">
          <div>
            <span className="tm-kicker">WireGuard</span>
            <h3>{wireguard.status === "ok" ? "Interface reported" : wireguard.status}</h3>
          </div>
          <span className={`tm-state-pill ${wireguard.status === "ok" ? "tm-state-up" : "tm-state-down"}`}>
            {wireguard.status}
          </span>
        </div>

        {wireguard.interfaces.length > 0 ? (
          <>
            <div className="tm-stat-row tm-stat-row-three">
              <Stat label="Interface" value={wireguard.interfaces[0].name} />
              <Stat label="Port" value={formatNumber(wireguard.interfaces[0].listeningPort)} />
              <Stat label="Peers" value={formatNumber(wireguard.interfaces[0].peerCount)} />
            </div>
            <div className="tm-mini-list tm-vpn-peers">
              {wireguard.interfaces.flatMap((entry) =>
                entry.peers.map((peer, index) => (
                  <div className="tm-mini-row" key={`${entry.name}-${index}`}>
                    <span className="tm-mono">Peer {String(index + 1).padStart(2, "0")}</span>
                    <span>{formatHandshakeAge(peer.latestHandshakeSecondsAgo)}</span>
                    <span className="tm-mono">↓ {formatBytes(peer.transfer.receivedBytes)}</span>
                    <span className="tm-mono">↑ {formatBytes(peer.transfer.sentBytes)}</span>
                  </div>
                )),
              )}
            </div>
            <div className="tm-inline-meta">
              <span>Latest handshake {formatHandshakeAge(latestHandshake)}</span>
              <span>{formatBytes(totalRx)} received</span>
              <span>{formatBytes(totalTx)} sent</span>
            </div>
          </>
        ) : (
          <EmptyState compact title="No WireGuard interface reported" />
        )}
      </div>

      <div className="tm-vpn-block">
        <div className="tm-subsection-head">
          <div>
            <span className="tm-kicker">Tailscale</span>
            <h3>{tailscale.backendState}</h3>
          </div>
          <span className={`tm-state-pill ${tailscale.selfOnline ? "tm-state-up" : "tm-state-down"}`}>
            {tailscale.selfOnline ? "online" : "offline"}
          </span>
        </div>

        <div className="tm-tailscale-grid">
          <div>
            <span>Backend</span>
            <strong>{tailscale.backendState}</strong>
          </div>
          <div>
            <span>Peer count</span>
            <strong className="tm-mono">{formatNumber(tailscale.peerCount)}</strong>
          </div>
          <div>
            <span>Online peers</span>
            <strong className="tm-mono">{formatNumber(tailscale.onlinePeers)}</strong>
          </div>
          <div>
            <span>Offline peers</span>
            <strong className="tm-mono">{formatNumber(tailscale.offlinePeers)}</strong>
          </div>
        </div>
      </div>

      <p className="tm-panel-note">
        <LockKeyhole size={13} strokeWidth={1.8} aria-hidden="true" /> Peer identities, endpoints and private keys are never exposed by the backend or this page.
      </p>
    </TelemetryPanel>
  );
}
