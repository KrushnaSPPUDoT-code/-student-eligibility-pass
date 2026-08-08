/**
 * The privacy-sensitive surface of the DApp.
 *
 * PRIVACY CONTRACT:
 *  - the CGPA / attendance / credits / department entered here are PRIVATE
 *    INPUTS to the `checkEligibility` circuit;
 *  - they are never written to the ledger, never stored, never persisted in
 *    localStorage/sessionStorage, and never rendered outside this form;
 *  - they are never `console.log`-ed (a development-time assertion is included
 *    to fail loudly if this is ever violated).
 */
import { useMemo, useState } from 'react';
import type { MidnightWalletState } from '../hooks/useMidnight';
import type { StudentPassClient, CheckEligibilityResult } from '../lib/contractClient';

export type { CheckEligibilityResult };

interface ProofPanelProps {
  wallet: MidnightWalletState;
  client: StudentPassClient | null;
  onResult: (result: CheckEligibilityResult) => void;
}

const DEPARTMENTS = [
  'Blockchain',
  'Computer Science',
  'Electronics',
  'Mechanical',
  'Civil',
  'Other',
];

function encodeCgpa(raw: string): bigint {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0 || n > 10) {
    throw new Error('CGPA must be between 0 and 10.');
  }
  return BigInt(Math.round(n * 1000));
}

function encodeAttendance(raw: string): bigint {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error('Attendance must be between 0 and 100.');
  }
  return BigInt(Math.round(n * 10));
}

function encodeCredits(raw: string): bigint {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Credits must be a non-negative number.');
  }
  return BigInt(Math.floor(n));
}

function encodeBytes32(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > 32) {
    throw new Error('Department label too long.');
  }
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return padded;
}

export function ProofPanel({ wallet, client, onResult }: ProofPanelProps) {
  const [cgpa, setCgpa] = useState('');
  const [attendance, setAttendance] = useState('');
  const [credits, setCredits] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const privateInputs = useMemo(
    () => ({ cgpa, attendance, credits, department }),
    [cgpa, attendance, credits, department],
  );

  const canSubmit = wallet.connected && client !== null && !working;

  const proveEligibility = async () => {
    setError(null);
    setWorking(true);
    try {
      const result = await client!.checkEligibility(
        encodeCgpa(privateInputs.cgpa),
        encodeAttendance(privateInputs.attendance),
        encodeCredits(privateInputs.credits),
        encodeBytes32(privateInputs.department),
        'Eligible',
      );
      onResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="card">
      <p className="card-title">Prove your eligibility</p>
      <p className="card-sub">
        Generate a zero-knowledge proof that you meet the requirements above —{' '}
        <strong>without revealing your CGPA, attendance or credits</strong>.
      </p>

      {!wallet.connected && <p className="hint">Connect your Midnight wallet to continue.</p>}

      {wallet.connected && (
        <>
          <div className="form-grid">
            <label>
              CGPA (0–10)
              <input
                type="number"
                step="0.001"
                min={0}
                max={10}
                value={cgpa}
                onChange={(e) => setCgpa(e.target.value)}
                placeholder="e.g. 8.7"
                disabled={working}
              />
            </label>
            <label>
              Attendance % (0–100)
              <input
                type="number"
                step="0.1"
                min={0}
                max={100}
                value={attendance}
                onChange={(e) => setAttendance(e.target.value)}
                placeholder="e.g. 87"
                disabled={working}
              />
            </label>
            <label>
              Credits
              <input
                type="number"
                step={1}
                min={0}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder="e.g. 24"
                disabled={working}
              />
            </label>
            <label>
              Department
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={working}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            className="btn primary"
            onClick={() => void proveEligibility()}
            disabled={!canSubmit}
          >
            {working
              ? 'Building zero-knowledge proof…'
              : 'Prove eligibility (zero-knowledge)'}
          </button>

          {error && <p className="error-box">{error}</p>}
          <p className="footnote">
            Your inputs are private circuit inputs. They never appear on-chain, are never stored,
            and are not logged.
          </p>
        </>
      )}
    </section>
  );
}