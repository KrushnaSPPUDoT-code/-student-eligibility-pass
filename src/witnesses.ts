/**
 * Private state + witnesses for the Student Pass contract.
 *
 * PRIVACY: the only private state is the student's 32-byte secret key. The
 * academic values (cgpa, attendance, credits, department) are passed to
 * circuits as private inputs and are NEVER stored in private state, written
 * to the ledger, logged, or rendered anywhere — they only ever exist inside
 * the zero-knowledge circuits and the caller's browser/CLI for the duration
 * of a single proof.
 */
import type { WitnessContext } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type { Ledger } from '../contracts/managed/student_pass/contract/index.js';

/** The private state of the Student Pass contract. */
export type StudentPassPrivateState = {
  readonly secretKey: Uint8Array;
};

/** Creates an initial private state for a given secret key. */
export const createStudentPassPrivateState = (
  secretKey: Uint8Array,
): StudentPassPrivateState => ({
  secretKey,
});

/**
 * The witnesses object, one entry per `witness` declaration in the Compact
 * contract. Each implementation receives a `WitnessContext` and returns a
 * tuple of (new private state, witness value).
 */
export const witnesses = {
  secretKey: ({
    privateState,
  }: WitnessContext<Ledger, StudentPassPrivateState>): [
    StudentPassPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};