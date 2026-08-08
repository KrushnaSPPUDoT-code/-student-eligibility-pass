/**
 * Contract client for the Private Student Eligibility Pass frontend.
 *
 * Two clearly separated paths:
 *
 * 1. READ  — live PUBLIC state via the indexer GraphQL endpoint
 *            (`queryContractState` + the compiled contract's `ledger()` decode).
 * 2. WRITE — the DApp Connector wallet-driven path: the wallet extension
 *            proves (getProvingProvider), balances (balanceUnsealedTransaction)
 *            and submits (submitTransaction). The academic record is a
 *            transient private input to the circuit and is never stored,
 *            logged or rendered by this module.
 *
 * LAZY LOADING: the write path (the wallet bridge, the indexer provider and
 * especially the Level private-state provider) depends on the `level` /
 * `abstract-level` packages, which crash the browser at module evaluation
 * time (`Class extends value undefined`) if they land in the initial bundle.
 * None of those modules are imported at the top level here: they are fetched
 * with dynamic `import()` inside createStudentPassClient, so they are split
 * out of the main bundle and only load once a wallet connection exists and a
 * contract client actually needs to be created.
 */
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { Contract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import * as StudentPass from './contract/index.js';
import { queryRawContractState } from './indexer';
import type { StudentPassPrivateState } from './witnesses';

export type StudentLedger = StudentPass.Ledger;

/** Decode the latest public ledger state for `contractAddress`. */
export async function readPublicLedger(
  indexerUrl: string,
  contractAddress: string,
): Promise<StudentLedger | null> {
  const raw = await queryRawContractState(indexerUrl, contractAddress);
  if (!raw) return null;
  return StudentPass.ledger(raw.data as never);
}

export interface CheckEligibilityResult {
  lastResult: string;
  verifications: bigint;
  active: boolean;
  txId: string;
}

export interface UpdateRequirementsResult {
  verifications: bigint;
  txId: string;
}

export interface StudentPassClient {
  checkEligibility: (
    cgpa: bigint,
    attendance: bigint,
    credits: bigint,
    department: Uint8Array,
    resultLabel: string,
  ) => Promise<CheckEligibilityResult>;
  updateRequirements: (
    requiredCgpa: bigint,
    requiredAttendance: bigint,
    requiredCredits: bigint,
  ) => Promise<UpdateRequirementsResult>;
}

interface FoundStudentPassContract {
  callTx: {
    checkEligibility(
      cgpa: bigint,
      attendance: bigint,
      credits: bigint,
      department: Uint8Array,
      resultLabel: string,
    ): Promise<{
      public: { lastResult: string; verifications: bigint; active: boolean };
      txId: string;
    }>;
    updateRequirements(
      requiredCgpa: bigint,
      requiredAttendance: bigint,
      requiredCredits: bigint,
    ): Promise<{ public: { verifications: bigint }; txId: string }>;
  };
}

export interface CreateStudentPassClientOptions {
  api: ConnectedAPI;
  contractAddress: string;
  indexerUrl: string;
  indexerWsUrl: string;
  zkBaseUrl: string;
  network: string;
}

/**
 * Assemble the providers bundle and attach to the deployed contract.
 *
 * PRIVACY: the private state created here holds only the derived student
 * secret key. No academic values are ever part of private state.
 */
type StudentPassContract = StudentPass.Contract<StudentPassPrivateState>;
type StudentPassPck = Contract.ProvableCircuitId<StudentPassContract>;

export async function createStudentPassClient(
  options: CreateStudentPassClientOptions,
): Promise<StudentPassClient> {
  const {
    findDeployedContract,
    indexerPublicDataProvider,
    levelPrivateStateProvider,
    createBrowserWalletBridge,
    HttpZkConfigProvider,
    createHttpKeyMaterialProvider,
    StudentPassBrowserContract,
    createStudentPassPrivateState,
  } = await loadWriterDependencies();

  const { api, contractAddress, indexerUrl, indexerWsUrl, zkBaseUrl } = options;

  const zkConfigProvider = new HttpZkConfigProvider<StudentPassPck>(zkBaseUrl);
  const keyMaterial = createHttpKeyMaterialProvider(zkBaseUrl);

  const bridge = await createBrowserWalletBridge(api, { keyMaterial });

  const publicDataProvider = indexerPublicDataProvider(
    indexerUrl,
    indexerWsUrl,
    // The browser's native WebSocket — the package's Node `ws` default can't
    // load in a browser bundle, so we inject the global.
    globalThis.WebSocket as never,
  );

  const privateStateProvider = levelPrivateStateProvider({
    privateStateStoreName: 'student-pass-browser',
    accountId: bridge.coinPublicKeyHex,
    privateStoragePasswordProvider: async () => 'StudentPassBrowser!2026',
  });

  const secretKey = await deriveStudentSecretKey(bridge.coinPublicKeyHex);

  const providers = {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider: bridge.proofProvider,
    walletProvider: bridge.walletProvider,
    midnightProvider: bridge.midnightProvider,
  };

  const deployed = await findDeployedContract(providers, {
    compiledContract: StudentPassBrowserContract,
    contractAddress,
    privateStateId: 'student-pass-frontend',
    initialPrivateState: createStudentPassPrivateState(secretKey),
  });

  const found = deployed as unknown as FoundStudentPassContract;

  return {
    async checkEligibility(cgpa, attendance, credits, department, resultLabel) {
      const tx = await found.callTx.checkEligibility(
        cgpa,
        attendance,
        credits,
        department,
        resultLabel,
      );
      return {
        lastResult: tx.public.lastResult,
        verifications: tx.public.verifications,
        active: tx.public.active,
        txId: tx.txId,
      };
    },
    async updateRequirements(requiredCgpa, requiredAttendance, requiredCredits) {
      const tx = await found.callTx.updateRequirements(
        requiredCgpa,
        requiredAttendance,
        requiredCredits,
      );
      return { verifications: tx.public.verifications, txId: tx.txId };
    },
  };
}

interface WriterDependencies {
  findDeployedContract: typeof import('@midnight-ntwrk/midnight-js-contracts').findDeployedContract;
  indexerPublicDataProvider: typeof import('@midnight-ntwrk/midnight-js-indexer-public-data-provider').indexerPublicDataProvider;
  levelPrivateStateProvider: typeof import('@midnight-ntwrk/midnight-js-level-private-state-provider').levelPrivateStateProvider;
  createBrowserWalletBridge: typeof import('./walletBridge').createBrowserWalletBridge;
  HttpZkConfigProvider: typeof import('./httpZkConfigProvider').HttpZkConfigProvider;
  createHttpKeyMaterialProvider: typeof import('./httpZkConfigProvider').createHttpKeyMaterialProvider;
  StudentPassBrowserContract: typeof import('./studentPassContract').StudentPassBrowserContract;
  createStudentPassPrivateState: typeof import('./witnesses').createStudentPassPrivateState;
}

/**
 * Fetch the write-path dependencies on demand so the Level-based
 * private-state provider (and its `level` / `abstract-level` deps) never
 * enter the initial browser bundle.
 */
async function loadWriterDependencies(): Promise<WriterDependencies> {
  const [
    contracts,
    indexerProvider,
    levelProvider,
    walletBridge,
    zkConfig,
    browserContract,
    witnesses,
  ] = await Promise.all([
    import('@midnight-ntwrk/midnight-js-contracts'),
    import('@midnight-ntwrk/midnight-js-indexer-public-data-provider'),
    import('@midnight-ntwrk/midnight-js-level-private-state-provider'),
    import('./walletBridge'),
    import('./httpZkConfigProvider'),
    import('./studentPassContract'),
    import('./witnesses'),
  ]);

  return {
    findDeployedContract: contracts.findDeployedContract,
    indexerPublicDataProvider: indexerProvider.indexerPublicDataProvider,
    levelPrivateStateProvider: levelProvider.levelPrivateStateProvider,
    createBrowserWalletBridge: walletBridge.createBrowserWalletBridge,
    HttpZkConfigProvider: zkConfig.HttpZkConfigProvider,
    createHttpKeyMaterialProvider: zkConfig.createHttpKeyMaterialProvider,
    StudentPassBrowserContract: browserContract.StudentPassBrowserContract,
    createStudentPassPrivateState: witnesses.createStudentPassPrivateState,
  };
}

/**
 * Deterministic per-wallet student secret key (32 bytes) derived from the
 * wallet's coin public key via SHA-256, so the same wallet always owns the
 * same contract state. Never persisted anywhere.
 */
export async function deriveStudentSecretKey(coinPublicKeyHex: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(coinPublicKeyHex);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}