/**
 * Browser ZK-config provider.
 *
 * The compiled contract ships proving/verifying keys and ZKIR binaries under
 * `contracts/managed/student_pass/{keys,zkir}`. `frontend:sync-circuit` copies
 * them into `frontend/public/circuit`, so this provider can fetch them over
 * HTTP with plain `fetch`.
 *
 * Wraps each fetched binary with the runtime's `createProverKey` /
 * `createVerifierKey` / `createZKIR` so it can be handed to midnight-js and to
 * the wallet's `getProvingProvider(keyMaterialProvider)`.
 */
import {
  ZKConfigProvider,
  createProverKey,
  createVerifierKey,
  createZKIR,
  type ProverKey,
  type VerifierKey,
  type ZKIR,
} from '@midnight-ntwrk/midnight-js-types';

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ZK artifact ${url}: HTTP ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export class HttpZkConfigProvider<K extends string = string> extends ZKConfigProvider<K> {
  private readonly baseUrl: string;

  /** @param baseUrl e.g. `${location.origin}/circuit/student_pass` */
  constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getProverKey(circuitId: K): Promise<ProverKey> {
    return createProverKey(await fetchBytes(`${this.baseUrl}/keys/${circuitId}.prover`));
  }

  async getVerifierKey(circuitId: K): Promise<VerifierKey> {
    return createVerifierKey(await fetchBytes(`${this.baseUrl}/keys/${circuitId}.verifier`));
  }

  async getZKIR(circuitId: K): Promise<ZKIR> {
    return createZKIR(await fetchBytes(`${this.baseUrl}/zkir/${circuitId}.bzkir`));
  }
}

/**
 * The same accessors as a `KeyMaterialProvider` (the shape the wallet's
 * `getProvingProvider` expects). The `circuitKeyLocation` here is the plain
 * circuit id.
 */
export function createHttpKeyMaterialProvider<K extends string = string>(baseUrl: string) {
  const provider = new HttpZkConfigProvider<K>(baseUrl);
  return {
    async getZKIR(circuitKeyLocation: K) {
      return provider.getZKIR(circuitKeyLocation);
    },
    async getProverKey(circuitKeyLocation: K) {
      return provider.getProverKey(circuitKeyLocation);
    },
    async getVerifierKey(circuitKeyLocation: K) {
      return provider.getVerifierKey(circuitKeyLocation);
    },
  };
}