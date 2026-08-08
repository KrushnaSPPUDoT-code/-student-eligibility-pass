export type NetworkName = 'preview' | 'preprod';

export const NETWORK: NetworkName = (import.meta.env.VITE_NETWORK as NetworkName) ?? 'preview';

export const NETWORK_LABEL: string =
  NETWORK === 'preview' ? 'Midnight Preview' : 'Midnight Preprod';

export const CONTRACT_ADDRESS: string = import.meta.env.VITE_CONTRACT_ADDRESS ?? '';

export const INDEXER_URL: string =
  import.meta.env.VITE_INDEXER_URL ??
  (NETWORK === 'preview'
    ? 'https://indexer.preview.midnight.network/api/v4/graphql'
    : 'https://indexer.preprod.midnight.network/api/v4/graphql');

export const INDEXER_WS_URL: string =
  import.meta.env.VITE_INDEXER_WS_URL ??
  (NETWORK === 'preview'
    ? 'wss://indexer.preview.midnight.network/api/v4/graphql/ws'
    : 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws');

/**
 * Base URL for the ZK circuit artifacts (.prover/.verifier/.bzkir) served
 * from `frontend/public/circuit` (see `scripts/sync-circuit.mjs`). The base
 * route is `<base>/circuit/student_pass`.
 */
export const ZK_BASE_URL: string =
  import.meta.env.VITE_ZK_BASE_URL ?? `${import.meta.env.BASE_URL}circuit/student_pass`;