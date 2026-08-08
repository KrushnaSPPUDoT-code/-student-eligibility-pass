/**
 * Browser wallet bridge: adapts the Midnight DApp Connector `ConnectedAPI` to
 * the three midnight-js provider roles we need:
 *
 *   - `walletProvider`   → getCoinPublicKey / getEncryptionPublicKey / balanceTx
 *   - `midnightProvider` → submitTx
 *   - a `ProofProvider`    → built from the wallet's `getProvingProvider(...)`
 *
 * This is a *live* adapter: balancing happens inside the real wallet extension
 * (it picks inputs, adds fee/outputs and cryptographically binds the
 * transaction); submission uses the wallet as relayer. Proving is delegated to
 * the wallet too, so keys and private inputs never leave the browser.
 */
import type { ConnectedAPI, KeyMaterialProvider } from '@midnight-ntwrk/dapp-connector-api';
import {
  Transaction,
  type FinalizedTransaction,
  type TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  createProofProvider,
  type MidnightProvider,
  type ProofProvider,
  type UnboundTransaction,
  type WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { coinPublicKeyFromBech32, encryptionPublicKeyFromBech32 } from './address';

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 1 ? `0${hex}` : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export interface BrowserWalletBridge {
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
  proofProvider: ProofProvider;
  coinPublicKeyHex: string;
  encryptionPublicKeyHex: string;
}

/**
 * @param api The connected wallet's API.
 * @param options.keyMaterial ZK artifact feed for the wallet's proving provider.
 */
export async function createBrowserWalletBridge(
  api: ConnectedAPI,
  options: { keyMaterial?: KeyMaterialProvider },
): Promise<BrowserWalletBridge> {
  const shielded = await api.getShieldedAddresses();
  const coinPublicKeyHex = coinPublicKeyFromBech32(shielded.shieldedCoinPublicKey);
  const encryptionPublicKeyHex = encryptionPublicKeyFromBech32(
    shielded.shieldedEncryptionPublicKey,
  );

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => coinPublicKeyHex,
    getEncryptionPublicKey: () => encryptionPublicKeyHex,
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const { tx: balancedHex } = await api.balanceUnsealedTransaction(bytesToHex(tx.serialize()));
      return Transaction.deserialize(
        'signature',
        'proof',
        'binding',
        hexToBytes(balancedHex),
      );
    },
  };

  const midnightProvider: MidnightProvider = {
    async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
      // The transaction is already fee-paying and cryptographically bound after
      // balancing; the wallet simply relays it to the network.
      await api.submitTransaction(bytesToHex(tx.serialize()));
      return tx.transactionHash();
    },
  };

  const proofProvider: ProofProvider =
    options.keyMaterial !== undefined
      ? createProofProvider(await api.getProvingProvider(options.keyMaterial))
      : noWalletProvingProvider();

  return {
    walletProvider,
    midnightProvider,
    proofProvider,
    coinPublicKeyHex,
    encryptionPublicKeyHex,
  };
}

function noWalletProvingProvider(): ProofProvider {
  return {
    async proveTx(): Promise<UnboundTransaction> {
      throw new Error(
        'Proving is only available when the wallet exposes getProvingProvider and this DApp supplies ' +
          'the ZK key material for the Student Pass circuits.',
      );
    },
  };
}