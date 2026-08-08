/**
 * Witnesses + private-state creator for the browser build.
 *
 * PRIVACY: the only private state ever created is the student's 32-byte
 * secret key. Academic values (CGPA / attendance / credits / department) are
 * passed to circuits as private *inputs* at call time; they are never stored
 * in private state, never written to the ledger, never logged and never
 * rendered.
 */
import type { WitnessContext } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type { Ledger } from './contract/index.js';

export type StudentPassPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createStudentPassPrivateState = (
  secretKey: Uint8Array,
): StudentPassPrivateState => ({ secretKey });

export const witnesses = {
  secretKey: ({
    privateState,
  }: WitnessContext<Ledger, StudentPassPrivateState>): [
    StudentPassPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};