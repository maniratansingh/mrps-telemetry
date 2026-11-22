const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);

async function collectTailscale() {
  try {
    const { stdout } = await run('/usr/bin/tailscale', ['status', '--json'], {
      timeout: 6000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8'
    });
    const data = JSON.parse(stdout);
    const peers = Object.values(data.Peer || {});
    const online = peers.filter(peer => peer.Online === true).length;

    return {
      status: 'ok',
      backend_state: data.BackendState || 'unknown',
      self_online: data.Self ? data.Self.Online === true : null,
      peer_count: peers.length,
      online_peers: online,
      offline_peers: peers.length - online
    };
  } catch (error) {
    return {
      status: 'unavailable',
      error: error.message,
      message: 'Tailscale status unavailable',
      peer_count: null,
      online_peers: null,
      offline_peers: null
    };
  }
}

module.exports = { collectTailscale };
