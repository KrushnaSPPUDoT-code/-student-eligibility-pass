/**
 * Statically-typed compiled Student Pass contract with the witnesses wired in.
 * Used by deploy.ts / cli.ts (Node) and shared conceptually with the frontend
 * (which swaps the file-assets location for a browser URL or runs the
 * compiled circuits headlessly in the browser).
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import * as StudentPass from '../contracts/managed/student_pass/contract/index.js';
import { witnesses, type StudentPassPrivateState } from './witnesses';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const studentPassZkConfigPath = path.resolve(
  __dirname,
  '..',
  'contracts',
  'managed',
  'student_pass',
);

export const StudentPassContract = CompiledContract.make<
  StudentPass.Contract<StudentPassPrivateState>
>('StudentPass', StudentPass.Contract<StudentPassPrivateState>).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(studentPassZkConfigPath),
);