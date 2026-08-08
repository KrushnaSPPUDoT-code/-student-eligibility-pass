/**
 * Quick balance check for the active network without deploying anything.
 */
import { resolveNetwork, getOrCreateSeed } from './network';
import { createWallet, unshieldedToken } from './wallet';
import { WebSocket } from 'ws';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

async function main(): Promise<void> {
  const { network, config } = resolveNetwork();
  const seed = getOrCreateSeed(network);

  console.log(`Checking balance on: ${network}\n`);
  const walletCtx = await createWallet({ network, networkConfig: config, seed });
  const state = await walletCtx.wallet.waitForSyncedState();

  const address = walletCtx.unshieldedKeystore.getBech32Address().toString();
  const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  const dust = state.dust.balance(new Date());

  console.log(`  Wallet address: ${address}`);
  console.log(`  tNIGHT: ${balance.toLocaleString()}`);
  console.log(`  DUST:   ${dust.toLocaleString()}\n`);

  await persistWalletStateSafe(network, walletCtx);
  await walletCtx.wallet.stop();
}

import { persistWalletState } from './wallet';
async function persistWalletStateSafe(network: string, ctx: any): Promise<void> {
  try {
    await persistWalletState(network as any, ctx);
  } catch {
    // balance check is read-only; persistence is best-effort
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});