/**
 * Minimal, dependency-free GraphQL client for the Midnight indexer (the same
 * `CONTRACT_STATE_QUERY` the official `indexerPublicDataProvider` runs).
 *
 * This is the PUBLIC READ path — it only ever returns *public* contract state.
 * It never touches private inputs.
 */
import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';

export interface IndexerReadError extends Error {}

const CONTRACT_STATE_QUERY = `query CONTRACT_STATE_QUERY($address: HexEncoded!) {
  contractAction(address: $address) { state }
}`;

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * Fetch the latest public contract state for a deployed contract address.
 *
 * @returns the raw deserialized Compact state value, or `null` if the indexer
 *          has not seen the contract (e.g. address not deployed / not indexed).
 */
export async function queryRawContractState(
  indexerUrl: string,
  address: string,
): Promise<{ data: unknown } | null> {
  const response = await fetch(indexerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: CONTRACT_STATE_QUERY, variables: { address } }),
  });
  if (!response.ok) {
    throw new Error(`Indexer request failed: HTTP ${response.status}`);
  }
  const json = (await response.json()) as {
    data?: { contractAction?: { state?: string | null } | null };
    errors?: unknown[];
  };
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Indexer returned errors: ${JSON.stringify(json.errors)}`);
  }
  const stateHex = json.data?.contractAction?.state;
  if (!stateHex) return null;
  const contractState = ContractState.deserialize(hexToBytes(stateHex));
  return { data: contractState.data };
}

/**
 * Decode a raw contract state value into the Student Pass public ledger.
 */
export function decodeLedger(
  raw: { data: unknown },
  ledgerFn: (stateValue: unknown) => unknown,
): ReturnType<typeof ledgerFn> {
  return ledgerFn(raw.data);
}