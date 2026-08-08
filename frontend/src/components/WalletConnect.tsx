import type { MidnightWalletState } from '../hooks/useMidnight';

export function WalletConnect({ wallet }: { wallet: MidnightWalletState }) {
  if (!wallet.walletPresent) {
    return (
      <div className="card warn-card">
        <p className="card-title">No Midnight wallet detected</p>
        <p className="card-sub">
          Install and unlock a Midnight wallet that supports the DApp Connector API v4 (such as
          Midnight Lace), then refresh this page.
        </p>
      </div>
    );
  }

  if (!wallet.connected) {
    return (
      <div className="card">
        <p className="card-title">Midnight Wallet</p>
        <p className="card-sub">
          Connect to prove your eligibility with a private, on-chain zero-knowledge proof.
        </p>
        <button
          className="btn primary"
          onClick={() => void wallet.connectWallet()}
          disabled={wallet.connecting}
        >
          {wallet.connecting ? 'Connecting…' : 'Connect'}
        </button>
        {wallet.error && <p className="error-box">{wallet.error}</p>}
      </div>
    );
  }

  return (
    <div className="card ok-card">
      <div className="card-row">
        <span className="dot" />
        <span className="card-title">Connected</span>
      </div>
      <p className="mono">{wallet.walletName}</p>
      <p className="mono small ellipsis">
        {wallet.address ? `unshielded: ${shorten(wallet.address)}` : 'no unshielded address'}
      </p>
      <button className="btn ghost" onClick={() => void wallet.disconnectWallet()}>
        Disconnect
      </button>
    </div>
  );
}

function shorten(address: string, head = 10, tail = 10): string {
  if (address.length <= head + tail) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}