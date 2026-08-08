/**
 * CLI for the Student Pass contract.
 *
 * PRIVACY: this CLI accepts private inputs (CGPA, attendance, credits,
 * department) and feeds them into the contract's circuits, but NEVER prints
 * them, never writes them to state files, and never logs them. Only public
 * ledger state and the coarse eligibility result are shown.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { WebSocket } from 'ws';

// Midnight SDK imports
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import * as Student from '../contracts/managed/student_pass/contract/index.js';
import { resolveNetwork, getOrCreateSeed, getDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet';
import { StudentPassContract, studentPassZkConfigPath } from './contract';
import { createStudentPassPrivateState } from './witnesses';
import {
  deriveSecretKey,
  toHex,
  toBytes32,
  cgpaToUint,
  attendanceToUint,
  creditsToUint,
  cgpaFromUint,
  attendanceFromUint,
  isDepartment,
  SUPPORTED_DEPARTMENTS,
} from './student-pass-utils';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

// Must match the privateStateId used at deploy time so the CLI reconnects to
// the same private state (the student's secret key).
const PRIVATE_STATE_ID = 'studentPassPrivateState';

const { network, config: networkConfig } = resolveNetwork();
const SEED = getOrCreateSeed(network);

async function createProviders(walletCtx: WalletContext) {
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';

  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(studentPassZkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'student-pass-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

// ─── Public-state rendering (never prints private inputs) ─────────────────

function renderLedger(state: Student.Ledger): void {
  console.log('  ── Public contract state ────────────────────────────');
  console.log(`  Required CGPA:       ${cgpaFromUint(state.requiredCgpa)}`);
  console.log(`  Required attendance: ${attendanceFromUint(state.requiredAttendance)}`);
  console.log(`  Required credits:    ${state.requiredCredits.toString()}`);
  console.log(`  Verifications:       ${state.verifications.toString()}`);
  console.log(`  Last result:         ${state.lastResult.is_some ? state.lastResult.value : '(none)'}`);
  console.log(`  Pass owner:          0x${toHex(state.passOwner)}`);
  console.log(`  Pass commitment:     0x${toHex(state.profileCommitment)}`);
  console.log(`  Pass status:         ${state.active === 1n ? 'issued' : 'revoked'}`);
  console.log('  ─────────────────────────────────────────────────────');
  console.log('  (CGPA, attendance, credits and department are private —\n' +
              '   they never appear anywhere on this chain.)\n');
}

async function readPublicState(providers: any, address: string): Promise<Student.Ledger | null> {
  const contractState = await providers.publicDataProvider.queryContractState(address);
  if (!contractState) return null;
  return Student.ledger(contractState.data);
}

// ─── Private-input helpers (results are used in circuits, never printed) ─

async function readDept(rl: Awaited<ReturnType<typeof createInterface>>, prompt: string): Promise<string> {
  while (true) {
    const raw = await rl.question(`  ${prompt}: `);
    const v = raw.trim();
    if (isDepartment(v)) return v;
    console.log(`  ❌ Invalid department. Choose one of: ${SUPPORTED_DEPARTMENTS.join(', ')}`);
  }
}

async function readCgpa(rl: Awaited<ReturnType<typeof createInterface>>, prompt: string): Promise<bigint> {
  while (true) {
    const raw = await rl.question(`  ${prompt}: `);
    const v = parseFloat(raw.trim());
    if (Number.isFinite(v) && v >= 0 && v <= 10) return cgpaToUint(v);
    console.log('  ❌ Please enter a CGPA between 0.000 and 10.000 (e.g. 8.7).');
  }
}

async function readPercent(rl: Awaited<ReturnType<typeof createInterface>>, prompt: string): Promise<bigint> {
  while (true) {
    const raw = await rl.question(`  ${prompt}: `);
    const v = parseFloat(raw.trim());
    if (Number.isFinite(v) && v >= 0 && v <= 100) return attendanceToUint(v);
    console.log('  ❌ Please enter a percentage between 0 and 100 (e.g. 87).');
  }
}

async function readWhole(rl: Awaited<ReturnType<typeof createInterface>>, prompt: string): Promise<bigint> {
  while (true) {
    const raw = await rl.question(`  ${prompt}: `);
    const v = raw.trim();
    if (/^\d+$/.test(v) && BigInt(v) >= 0n) return creditsToUint(Number(v));
    console.log('  ❌ Please enter a non-negative whole number.');
  }
}

async function readLabel(rl: Awaited<ReturnType<typeof createInterface>>, prompt: string): Promise<string> {
  while (true) {
    const raw = await rl.question(`  ${prompt}: `);
    const v = raw.trim();
    if (v.length > 0 && v.length <= 32) return v;
    console.log('  ❌ Please enter 1 to 32 characters.');
  }
}

// ─── Main CLI ──────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              Student Pass CLI                                ║');
  console.log('║  Prove CGPA/attendance/credit eligibility without exposing   ║');
  console.log('║  your academic record.                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const rl = createInterface({ input: stdin, output: stdout });

  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}. Run \`npm run setup -- --network ${network}\` first.`);
    process.exit(1);
  }
  console.log(`  Contract: ${deployment.address}`);
  console.log(`  Network: ${network}\n`);

  try {
    const seed = SEED;

    console.log('  Connecting to wallet...');
    const walletCtx = await createWallet({ network, networkConfig, seed });
    const restoredCount = Object.values(walletCtx.restored).filter(Boolean).length;
    if (restoredCount > 0) {
      console.log(`  Restored ${restoredCount}/3 child wallets from .midnight-wallet-state — sync will resume from saved point.`);
    }

    console.log('  Syncing with network...');
    console.log('  ℹ  This may take several minutes depending on network size.\n');
    const syncStart = Date.now();
    const syncInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - syncStart) / 1000);
      process.stdout.write(`\r  ⏳ Still syncing... (${elapsed}s elapsed)   `);
    }, 5000);
    const state = await walletCtx.wallet.waitForSyncedState();
    clearInterval(syncInterval);
    process.stdout.write('\r  ✓ Synced with network.                                      \n');
    await persistWalletState(network, walletCtx);

    console.log('  Connecting to contract...');
    const providers = await createProviders(walletCtx);

    const deployed: any = await findDeployedContract(providers, {
      compiledContract: StudentPassContract as any,
      contractAddress: deployment.address,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: createStudentPassPrivateState(deriveSecretKey(seed)),
    });

    console.log('  ✅ Connected!\n');

    let running = true;
    while (running) {
      console.log('─── Menu ───────────────────────────────────────────────────────');
      console.log('  1. Publish/update eligibility requirements (PUBLIC)');
      console.log('  2. Issue my pass (private academic record)');
      console.log('  3. Check eligibility (zero-knowledge proof)');
      console.log('  4. Revoke my pass (erase it)');
      console.log('  5. Read public contract state');
      console.log('  6. Check wallet balance');
      console.log('  7. Exit\n');

      const choice = await rl.question('  Your choice: ');

      switch (choice.trim()) {
        case '1': {
          console.log('\n  🌐 PUBLIC ELIGIBILITY REQUIREMENTS');
          const rCgpa = await readCgpa(rl, 'Required CGPA (e.g. 8.0)');
          const rAtt = await readPercent(rl, 'Required attendance % (e.g. 75)');
          const rCredits = await readWhole(rl, 'Required credits (e.g. 20)');
          console.log('\n  Submitting updateRequirements transaction (may take 30-60s)...');
          try {
            const tx = await deployed.callTx.updateRequirements(rCgpa, rAtt, rCredits);
            console.log(`\n  ✅ Requirements published: CGPA >= ${cgpaFromUint(rCgpa)}, attendance >= ${attendanceFromUint(rAtt)}, credits >= ${rCredits.toString()}`);
            console.log('     🌐 These are public — every student can now see them.');
            console.log(`  Transaction ID: ${tx.public.txId}`);
            console.log(`  Block height: ${tx.public.blockHeight}\n`);
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '2': {
          console.log('\n  🔒 PRIVATE ACADEMIC RECORD (issuePass)');
          console.log('  These values are used inside a zero-knowledge circuit. Only a\n' +
                      '  one-way commitment of them is written to the blockchain.\n');
          const cgpa = await readCgpa(rl, 'Your CGPA (e.g. 8.7)');
          const att = await readPercent(rl, 'Your attendance % (e.g. 87)');
          const credits = await readWhole(rl, 'Your accumulated credits (e.g. 24)');
          const dept = await readDept(rl, 'Your department');
          console.log('\n  Submitting issuePass transaction...');
          try {
            const tx = await deployed.callTx.issuePass(cgpa, att, credits, toBytes32(dept));
            console.log('\n  ✅ Academic record issued. 🔒 Your values were committed, not exposed.');
            console.log(`  Transaction ID: ${tx.public.txId}`);
            console.log(`  Block height: ${tx.public.blockHeight}\n`);
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '3': {
          console.log('\n  🔒 ENTER YOUR PRIVATE VALUES (must match the issued pass)');
          const cgpa = await readCgpa(rl, 'Your CGPA');
          const att = await readPercent(rl, 'Your attendance %');
          const credits = await readWhole(rl, 'Your accumulated credits');
          const dept = await readDept(rl, 'Your department');
          const label = await readLabel(rl, 'Result label to disclose (e.g. Eligible)');

          console.log('\n  Submitting checkEligibility proof (may take 30-60s)...');
          try {
            const tx = await deployed.callTx.checkEligibility(cgpa, att, credits, toBytes32(dept), label);
            console.log('\n  ✅ Eligible ✓');
            console.log('     🔒 Your academic values were proved against the public requirements but never revealed.');
            console.log(`  Transaction ID: ${tx.public.txId}`);
            console.log(`  Block height: ${tx.public.blockHeight}\n`);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('\n  ✕ Not Eligible —', msg);
          }
          break;
        }

        case '4': {
          console.log('\n  🗑  REVOKE PASS (right to erasure)');
          console.log('  Clears the on-chain commitment and marks the pass inactive.\n');
          try {
            const tx = await deployed.callTx.revokePass();
            console.log('\n  ✅ Pass revoked — your private record is no longer referenced on-chain.');
            console.log(`  Transaction ID: ${tx.public.txId}\n`);
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '5': {
          console.log('\n  Reading public contract state...');
          try {
            const ledgerState = await readPublicState(providers, deployment.address);
            if (ledgerState) renderLedger(ledgerState);
            else console.log('\n  No contract state found yet.\n');
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '6': {
          console.log('\n  Checking balance...');
          const currentState = await walletCtx.wallet.waitForSyncedState();
          const currentBalance = currentState.unshielded.balances[unshieldedToken().raw] ?? 0n;
          const dustBalance = currentState.dust.balance(new Date());
          console.log(`\n  tNight: ${currentBalance.toLocaleString()}`);
          console.log(`  DUST: ${dustBalance.toLocaleString()}\n`);
          break;
        }

        case '7':
          running = false;
          console.log('\n  👋 Goodbye!\n');
          break;

        default:
          console.log('\n  ❌ Invalid choice. Please enter 1-7.\n');
      }
    }

    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);