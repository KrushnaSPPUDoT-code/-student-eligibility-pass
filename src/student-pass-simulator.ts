/**
 * Headless test simulator for the Student Pass contract.
 *
 * Runs circuits via the Compact runtime VM directly — no proof server, no
 * Docker, no wallet. Mirrors the proven pattern from example-bboard and the
 * sibling projects on this machine.
 */
import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  type Ledger,
  ledger,
  pureCircuits,
} from '../contracts/managed/student_pass/contract/index.js';
import type { StudentPassPrivateState } from '../src/witnesses.js';
import { witnesses } from '../src/witnesses.js';

export interface EligibilityRequirements {
  requiredCgpa: bigint;
  requiredAttendance: bigint;
  requiredCredits: bigint;
}

export interface PrivateAcademicRecord {
  cgpa: bigint;
  attendance: bigint;
  credits: bigint;
  department: Uint8Array;
}

export const RESULT_LABEL = 'Eligible';

export class StudentPassSimulator {
  readonly contract: Contract<StudentPassPrivateState>;
  circuitContext: CircuitContext<StudentPassPrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<StudentPassPrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext({ secretKey }, '0'.repeat(64)),
      );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  /** Switches to a different user (different secret key). */
  switchUser(secretKey: Uint8Array): void {
    this.circuitContext.currentPrivateState = { secretKey };
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  getPrivateState(): StudentPassPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /** The derived public owner key for the current user's secret key. */
  publicKey(): Uint8Array {
    return pureCircuits.ownerKey(this.getPrivateState().secretKey);
  }

  /** PUBLIC action: publish/update the eligibility requirements. */
  updateRequirements(
    requiredCgpa: bigint,
    requiredAttendance: bigint,
    requiredCredits: bigint,
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits.updateRequirements(
      this.circuitContext,
      requiredCgpa,
      requiredAttendance,
      requiredCredits,
    ).context;
    return this.getLedger();
  }

  /** Associate the student's PRIVATE academic record with this pass. */
  issuePass(record: PrivateAcademicRecord): Ledger {
    this.circuitContext = this.contract.impureCircuits.issuePass(
      this.circuitContext,
      record.cgpa,
      record.attendance,
      record.credits,
      record.department,
    ).context;
    return this.getLedger();
  }

  /** The core zero-knowledge proof: meets requirements? */
  checkEligibility(
    record: PrivateAcademicRecord,
    requirements: EligibilityRequirements,
    resultLabel: string = RESULT_LABEL,
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits.checkEligibility(
      this.circuitContext,
      record.cgpa,
      record.attendance,
      record.credits,
      record.department,
      resultLabel,
    ).context;
    return this.getLedger();
  }

  /** PRIVATE action: the student erases their own pass. */
  revokePass(): Ledger {
    this.circuitContext = this.contract.impureCircuits.revokePass(
      this.circuitContext,
    ).context;
    return this.getLedger();
  }
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

/** Zero-padded 32-byte encoding of a short UTF-8 string. */
export function toBytes32(value: string): Uint8Array {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > 32) {
    throw new Error(`Value too long for Bytes<32>: ${bytes.length} bytes`);
  }
  const out = new Uint8Array(32);
  out.set(bytes);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}