/**
 * React hook around the Midnight DApp Connector API (v4).
 *
 * Spec behaviours implemented:
 *  - wallet present     → detection / presence via window.midnight + events
 *  - discovered         → enumerated at runtime, never hard‑coded
 *  - connected          → session state + the `ConnectedAPI` handle
 *  - network validation → confirmed against the DApp's requested network
 *  - credentials        → the unshielded address is exposed
 *  - disconnect / errors → explicit control surface
 */
import { useCallback, useEffect, useState } from 'react';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { NETWORK, NETWORK_LABEL } from '../env';

interface WindowMidnight {
  [walletName: string]: InitialAPI;
}

declare global {
  interface Window {
    midnight?: WindowMidnight;
  }
}

function detectWalletApis(): Array<{ name: string; api: InitialAPI }> {
  const midnight = window.midnight;
  if (!midnight || typeof midnight !== 'object') return [];
  return Object.entries(midnight).map(([name, api]) => ({ name, api }));
}

export interface MidnightWalletState {
  walletPresent: boolean;
  connected: boolean;
  connecting: boolean;
  walletName: string | null;
  error: string | null;
  address: string | null;
  api: ConnectedAPI | null;
  networkId: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  clearError: () => void;
}

export function useMidnight(): MidnightWalletState {
  const [walletPresent, setWalletPresent] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [api, setApi] = useState<ConnectedAPI | null>(null);

  useEffect(() => {
    const refresh = () => setWalletPresent(detectWalletApis().length > 0);
    refresh();
    window.addEventListener('midnight:available', refresh);
    window.addEventListener('midnight:unavailable', refresh);
    return () => {
      window.removeEventListener('midnight:available', refresh);
      window.removeEventListener('midnight:unavailable', refresh);
    };
  }, []);

  const connectWallet = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const candidates = detectWalletApis();
      if (candidates.length === 0) {
        throw new Error(
          'No Midnight wallet detected. Install and unlock a Midnight wallet (DApp Connector API v4) and refresh.',
        );
      }

      for (const { name, api } of candidates) {
        try {
          if (typeof api?.connect !== 'function') continue;

          const apiVersion = typeof api.apiVersion === 'string' ? api.apiVersion : 'unknown';

          // Connect negotiation across protocol generations:
          //  - v4 wallets expose connect(networkId)
          //  - v3 wallets expose connect(desiredApiVersion, networkId) and advertise apiVersion '3.x'
          // We try the matching form first, then fall back to the other.
          const connect = api.connect.bind(api) as (...args: unknown[]) => Promise<ConnectedAPI>;
          const forms: Array<unknown[]> =
            apiVersion.startsWith('4') || apiVersion === 'unknown'
              ? [[NETWORK], ['4', NETWORK]]
              : [['4', NETWORK], [NETWORK]];

          let connectedApi: ConnectedAPI | null = null;
          let lastFormError: unknown = null;
          for (const args of forms) {
            try {
              connectedApi = await (connect(...args) as Promise<ConnectedAPI>);
              if (connectedApi) break;
            } catch (formError) {
              lastFormError = formError;
            }
          }
          if (!connectedApi) {
            if (lastFormError) throw lastFormError;
            continue;
          }

          // Network validation: the wallet must be on the network this DApp targets.
          if (typeof connectedApi.getConfiguration === 'function') {
            const configuration = await connectedApi.getConfiguration();
            if (configuration.networkId !== NETWORK) {
              throw new Error(
                `Wallet is on "${configuration.networkId}" but this DApp targets "${NETWORK}".`,
              );
            }
          }

          const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
          setAddress(unshieldedAddress);
          setWalletName(`${name} (apiVersion ${apiVersion})`);
          setApi(connectedApi);
          setConnected(true);
          return;
        } catch (candidateError) {
          const message = candidateError instanceof Error ? candidateError.message : String(candidateError);
          setError(
            `Wallet "${name}" (apiVersion ${'apiVersion' in api ? api.apiVersion : 'unknown'}) failed: ${message}`,
          );
        }
      }

      setError(
        `No wallet could connect on network "${NETWORK}" (${NETWORK_LABEL}). ` +
          'Check the wallet is unlocked and on the matching network.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    setConnected(false);
    setApi(null);
    setAddress(null);
    setWalletName(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    walletPresent,
    connected,
    connecting,
    walletName,
    error,
    address,
    api,
    networkId: NETWORK,
    connectWallet,
    disconnectWallet,
    clearError,
  };
}