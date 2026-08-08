/**
 * Tests for the Private Student Eligibility Pass contract.
 *
 * Runs headlessly through the Compact runtime VM (no proof server, no Docker).
 * Covers: (a) the eligibility matrix — every requirement met and each
 * individual / combined failure mode; (b) ledger state transitions; and (c)
 * the privacy guarantee that the private academic values (CGPA, attendance,
 * credits, department) are never exposed in any ledger state or circuit
 * output.
 */
import { describe, it, expect } from 'vitest';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  StudentPassSimulator,
  randomBytes,
  toBytes32,
  toHex,
  RESULT_LABEL,
  type PrivateAcademicRecord,
} from '../src/student-pass-simulator.js';

setNetworkId('undeployed');

// Example student from the assignment: CGPA 8.7, attendance 87%, credits 24,
// department "Blockchain". CGPA is x1000 (8700), attendance per-mille (870).
const STUDENT: PrivateAcademicRecord = {
  cgpa: 8700n,
  attendance: 870n,
  credits: 24n,
  department: toBytes32('Blockchain'),
};

// Scholarship requirements: CGPA >= 8.0, attendance >= 75%, credits >= 20.
const REQUIREMENTS = {
  requiredCgpa: 8000n,
  requiredAttendance: 750n,
  requiredCredits: 20n,
};

const INIT_OWNER = toBytes32('student-pass:no-owner');
const INIT_COMMITMENT = toBytes32('student-pass:no-record');
const REVOKED_COMMITMENT = toBytes32('student-pass:revoked');

describe('Student Pass contract', () => {
  it('initializes ledger state deterministically with no exposed record', () => {
    const key = randomBytes(32);
    const simA = new StudentPassSimulator(key);
    const simB = new StudentPassSimulator(key);

    const ledgerA = simA.getLedger();
    const ledgerB = simB.getLedger();

    expect(ledgerA).toEqual(ledgerB);
    expect(ledgerA.requiredCgpa).toEqual(0n);
    expect(ledgerA.requiredAttendance).toEqual(0n);
    expect(ledgerA.requiredCredits).toEqual(0n);
    expect(ledgerA.verifications).toEqual(0n);
    expect(ledgerA.lastResult.is_some).toBe(false);
    expect(ledgerA.active).toEqual(0n);
    expect(toHex(ledgerA.passOwner)).toBe(toHex(INIT_OWNER));
    expect(toHex(ledgerA.profileCommitment)).toBe(toHex(INIT_COMMITMENT));
    expect(ledgerA.passOwner).toHaveLength(32);
    expect(ledgerA.profileCommitment).toHaveLength(32);

    expect(simA.getPrivateState()).toEqual({ secretKey: key });
  });

  it('publishes requirements as PUBLIC state that any observer can read', () => {
    const sim = new StudentPassSimulator(randomBytes(32));

    const ledgerState = sim.updateRequirements(
      REQUIREMENTS.requiredCgpa,
      REQUIREMENTS.requiredAttendance,
      REQUIREMENTS.requiredCredits,
    );

    expect(ledgerState.requiredCgpa).toEqual(8000n);
    expect(ledgerState.requiredAttendance).toEqual(750n);
    expect(ledgerState.requiredCredits).toEqual(20n);
    // No private record touched.
    expect(toHex(ledgerState.passOwner)).toBe(toHex(INIT_OWNER));
    expect(ledgerState.active).toEqual(0n);
  });

  it('issues a pass publishing only the owner key and commitment, never the record', () => {
    const key = randomBytes(32);
    const sim = new StudentPassSimulator(key);

    const ledgerState = sim.issuePass(STUDENT);

    // Derived owner key (a one-way hash of the secret key, never the key itself).
    expect(toHex(ledgerState.passOwner)).toBe(toHex(sim.publicKey()));
    expect(toHex(ledgerState.passOwner)).not.toBe(toHex(key));
    expect(toHex(ledgerState.passOwner)).not.toBe(toHex(INIT_OWNER));
    // Commitment is bound to the record.
    expect(toHex(ledgerState.profileCommitment)).not.toBe(toHex(INIT_COMMITMENT));
    // The pass is now active.
    expect(ledgerState.active).toEqual(1n);
    // No private value is stored in the private state.
    expect(sim.getPrivateState()).toEqual({ secretKey: key });
  });

  it('1. satisfies every requirement → Eligible', () => {
    const sim = new StudentPassSimulator(randomBytes(32));
    sim.issuePass(STUDENT);

    const ledgerState = sim.checkEligibility(STUDENT, REQUIREMENTS);

    expect(ledgerState.verifications).toEqual(1n);
    expect(ledgerState.lastResult.is_some).toBe(true);
    expect(ledgerState.lastResult.value).toBe(RESULT_LABEL);
  });

  it('2. CGPA below requirement → Not Eligible', () => {
    const sim = new StudentPassSimulator(randomBytes(32));
    sim.updateRequirements(8000n, 750n, 20n);
    sim.issuePass({ ...STUDENT, cgpa: 7990n }); // 7.99 < 8.00

    expect(() => sim.checkEligibility({ ...STUDENT, cgpa: 7990n }, REQUIREMENTS)).toThrow(
      /failed assert: Not eligible: CGPA is below the requirement/,
    );
  });

  it('3. attendance below requirement → Not Eligible', () => {
    const sim = new StudentPassSimulator(randomBytes(32));
    sim.updateRequirements(REQUIREMENTS.requiredCgpa, REQUIREMENTS.requiredAttendance, REQUIREMENTS.requiredCredits);
    sim.issuePass({ ...STUDENT, attendance: 700n }); // 70% < 75%

    expect(() => sim.checkEligibility({ ...STUDENT, attendance: 700n }, REQUIREMENTS)).toThrow(
      /failed assert: Not eligible: attendance is below the requirement/,
    );
  });

  it('4. credits below requirement → Not Eligible', () => {
    const sim = new StudentPassSimulator(randomBytes(32));
    sim.updateRequirements(REQUIREMENTS.requiredCgpa, REQUIREMENTS.requiredAttendance, REQUIREMENTS.requiredCredits);
    sim.issuePass({ ...STUDENT, credits: 12n }); // 12 < 20

    expect(() => sim.checkEligibility({ ...STUDENT, credits: 12n }, REQUIREMENTS)).toThrow(
      /failed assert: Not eligible: accumulated credits are below the requirement/,
    );
  });

  it('5. multiple failed requirements → Not Eligible', () => {
    const sim = new StudentPassSimulator(randomBytes(32));
    sim.updateRequirements(REQUIREMENTS.requiredCgpa, REQUIREMENTS.requiredAttendance, REQUIREMENTS.requiredCredits);
    // CGPA 6.5, attendance 40%, credits 5 — fails everything.
    const weak: PrivateAcademicRecord = {
      cgpa: 6500n,
      attendance: 400n,
      credits: 5n,
      department: toBytes32('Computer Science'),
    };
    sim.issuePass(weak);

    expect(() => sim.checkEligibility(weak, REQUIREMENTS)).toThrow(
      /failed assert: Not eligible:/,
    );
  });

  it('a non-owner cannot run a check', () => {
    const ownerKey = randomBytes(32);
    const sim = new StudentPassSimulator(ownerKey);
    sim.issuePass(STUDENT);

    sim.switchUser(randomBytes(32));
    expect(() => sim.checkEligibility(STUDENT, REQUIREMENTS)).toThrow(
      /failed assert: Only the student who owns this pass may check it/,
    );
  });

  it('rejects a record that does not match the committed profile', () => {
    const sim = new StudentPassSimulator(randomBytes(32));
    // Committed: CGPA 8.7 (8700). Claims CGPA 9.2 (9200).
    sim.issuePass(STUDENT);

    const exaggerated: PrivateAcademicRecord = { ...STUDENT, cgpa: 9200n };
    // updateRequirements so the range checks would otherwise pass for 9.2 >= 8.0.
    sim.updateRequirements(8000n, 750n, 20n);
    expect(() => sim.checkEligibility(exaggerated, REQUIREMENTS)).toThrow(
      /failed assert: Private record does not match the committed profile/,
    );
  });

  it('a non-owner cannot revoke someone else\'s pass', () => {
    const ownerKey = randomBytes(32);
    const sim = new StudentPassSimulator(ownerKey);
    sim.issuePass(STUDENT);

    sim.switchUser(randomBytes(32));
    expect(() => sim.revokePass()).toThrow(
      /failed assert: Only the student who owns this pass may revoke it/,
    );
  });

  it('revoking a pass erases the commitment and marks it inactive', () => {
    const sim = new StudentPassSimulator(randomBytes(32));
    sim.issuePass(STUDENT);

    const ledgerState = sim.revokePass();

    expect(toHex(ledgerState.profileCommitment)).toBe(toHex(REVOKED_COMMITMENT));
    expect(ledgerState.lastResult.is_some).toBe(false);
    expect(ledgerState.active).toEqual(0n);
  });

  it('enforces input-range validation at issue time', () => {
    const sim = new StudentPassSimulator(randomBytes(32));

    expect(() => sim.issuePass({ ...STUDENT, cgpa: 0n })).toThrow(
      /failed assert: CGPA must be a positive value/,
    );
    expect(() => sim.issuePass({ ...STUDENT, attendance: 0n })).toThrow(
      /failed assert: Attendance must be a positive value/,
    );
    expect(() => sim.issuePass({ ...STUDENT, credits: 0n })).toThrow(
      /failed assert: Credits must be a positive value/,
    );
  });

  it('never exposes the private academic values in ANY output — the privacy guarantee', () => {
    const secretKey = randomBytes(32);
    const sim = new StudentPassSimulator(secretKey);

    sim.updateRequirements(8000n, 750n, 20n);
    sim.issuePass(STUDENT);
    sim.checkEligibility(STUDENT, REQUIREMENTS);
    const ledgerState = sim.getLedger();

    // 1. Structural: the decoded ledger exposes ONLY the declared public fields.
    expect(Object.keys(ledgerState).sort()).toEqual([
      'active',
      'lastResult',
      'passOwner',
      'profileCommitment',
      'requiredAttendance',
      'requiredCgpa',
      'requiredCredits',
      'verifications',
    ]);

    // 2. The commitment is a 32-byte one-way hash binding the private values.
    expect(ledgerState.profileCommitment).toHaveLength(32);
    expect(toHex(ledgerState.profileCommitment)).not.toBe(toHex(toBytes32('8700')));
    expect(toHex(ledgerState.profileCommitment)).not.toBe(toHex(toBytes32('870')));
    expect(toHex(ledgerState.profileCommitment)).not.toBe(toHex(toBytes32('24')));
    expect(toHex(ledgerState.profileCommitment)).not.toBe(toHex(toBytes32('Blockchain')));

    // 3. A textual dump of ALL public state contains none of the private
    //    values and none of the secret key.
    const publicDump = JSON.stringify({
      requiredCgpa: ledgerState.requiredCgpa.toString(),
      requiredAttendance: ledgerState.requiredAttendance.toString(),
      requiredCredits: ledgerState.requiredCredits.toString(),
      verifications: ledgerState.verifications.toString(),
      passOwner: toHex(ledgerState.passOwner),
      profileCommitment: toHex(ledgerState.profileCommitment),
      active: ledgerState.active.toString(),
      lastResult: ledgerState.lastResult,
    });
    expect(publicDump).not.toContain(toHex(secretKey));
    expect(publicDump).not.toContain('Blockchain');
    // (Numeric private values — 8700, 870, 24 — are covered by the strict
    // bigint filter below; bare substring checks would collide with hex.)

    // 4. The only bigint on the ledger is the public counter and the public
    //    requirements — never the private record numbers.
    const values = Object.values(ledgerState);
    const bigints = values.filter((v): v is bigint => typeof v === 'bigint');
    expect(bigints).toEqual([8000n, 750n, 20n, 1n, 1n]);
    expect(bigints).not.toContain(8700n);
    expect(bigints).not.toContain(870n);

    // 5. The only string on the ledger is the coarse disclosed result label.
    const strings = values
      .filter(
        (v): v is { is_some: boolean; value: string } =>
          !!v && typeof v === 'object' && 'is_some' in v,
      )
      .map((v) => v.value);
    expect(strings).toEqual([RESULT_LABEL]);
    expect(strings).not.toContain('Blockchain');
  });
});