/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: string;
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_INDEXER_URL?: string;
  readonly VITE_INDEXER_WS_URL?: string;
  readonly VITE_ZK_BASE_URL?: string;
  readonly VITE_PROOF_SERVER_URL?: string;
  readonly BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}