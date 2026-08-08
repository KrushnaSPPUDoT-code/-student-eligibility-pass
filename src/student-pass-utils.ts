/**
 * Shared helpers for the Private Student Eligibility Pass contract.
 *
 * - `deriveSecretKey` deterministically derives the private-witness secret key
 *   from a wallet seed, so the deployer, CLI and tests stay the same "student".
 * - `toBytes32` zero-pads a short UTF-8 string into the 32-byte encoding the
 *   contract expects for `Bytes<32>` values.
 * - `cgpaToUint` / `attendanceToUint` / `creditsToUint` encode human grades
 *   into the integer ranges the Compact contract uses.
 *
 * PRIVACY: all helpers in this file are used on PRIVATE values. Callers must
 * never log, render or persist the returned scalars outside of a circuit call.
 */

import { createHash } from 'node:crypto';
import { Buffer } from 'buffer';

export const STUDENT_KEY_DERIVATION_TAG = 'student-pass:secret-key';

/** CGPA is scaled by 1000: 8.7 → 8700. */
export function cgpaToUint(cgpa: number): bigint {
  const scaled = Math.round(cgpa * 1000);
  if (!Number.isFinite(scaled) || scaled < 0 || scaled > 10000) {
    throw new Error(`CGPA must be in [0.000, 10.000], got: ${cgpa}`);
  }
  return BigInt(scaled);
}

/** Attendance is per-mille: 87.0% → 870. */
export function attendanceToUint(percent: number): bigint {
  const scaled = Math.round(percent * 10);
  if (!Number.isFinite(scaled) || scaled < 0 || scaled > 1000) {
    throw new Error(`Attendance must be in [0, 100]%, got: ${percent}`);
  }
  return BigInt(scaled);
}

/** Credits are whole numbers (e.g. 24). */
export function creditsToUint(credits: number): bigint {
  if (!Number.isFinite(credits) || credits < 0 || credits > 100000) {
    throw new Error(`Credits must be in [0, 100000], got: ${credits}`);
  }
  return BigInt(Math.floor(credits));
}

/** Display helpers for PUBLIC ledger thresholds only — never for private values. */
export function cgpaFromUint(v: bigint): string {
  return `${v / 1000n}.${(v % 1000n).toString().padStart(3, '0')}`;
}

export function attendanceFromUint(v: bigint): string {
  return `${(v / 10n).toString()}.${(v % 10n).toString()}%`;
}

export function deriveSecretKey(seed: string): Uint8Array {
  return new Uint8Array(
    createHash('sha256').update(`${STUDENT_KEY_DERIVATION_TAG}:${seed}`).digest(),
  );
}

export const SUPPORTED_DEPARTMENTS = [
  'Blockchain',
  'Computer Science',
  'Electronics',
  'Mechanical',
  'Civil',
  'Other',
] as const;
export type Department = (typeof SUPPORTED_DEPARTMENTS)[number];

export function isDepartment(value: string): value is Department {
  return (SUPPORTED_DEPARTMENTS as readonly string[]).includes(value);
}

export function toBytes32(value: string): Uint8Array {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > 32) {
    throw new Error(`Value too long for Bytes<32>: "${value}" (${bytes.length} bytes)`);
  }
  const out = new Uint8Array(32);
  out.set(bytes);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}