#!/usr/bin/env node
/**
 * Syncs artifacts from the compiled Student Pass contract into the frontend so
 * the browser build is self-contained:
 *
 *   contracts/managed/student_pass/contract  → frontend/src/lib/contract       (compiled TS)
 *   contracts/managed/student_pass/keys        → frontend/public/circuit/...  (zero-knowledge keys)
 *   contracts/managed/student_pass/zkir        → frontend/public/circuit/...  (ZKIR circuit IR)
 *
 * Run via: npm run frontend:sync-circuit  (wired into frontend:dev / frontend:build).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'contracts', 'managed', 'student_pass');
const contractDst = join(root, 'frontend', 'src', 'lib', 'contract');
const publicDst = join(root, 'frontend', 'public', 'circuit', 'student_pass');

if (!existsSync(src)) {
  console.error('❌ Missing contracts/managed/student_pass. Run `npm run compile` first.');
  process.exit(1);
}

rmSync(contractDst, { recursive: true, force: true });
rmSync(publicDst, { recursive: true, force: true });
mkdirSync(contractDst, { recursive: true });
mkdirSync(publicDst, { recursive: true });

cpSync(join(src, 'contract'), contractDst, { recursive: true });
for (const sub of ['keys', 'zkir']) {
  if (existsSync(join(src, sub))) {
    cpSync(join(src, sub), join(publicDst, sub), { recursive: true });
  }
}

console.log('✅ Frontend circuit sync complete:');
console.log(`   compiled contract → ${contractDst}`);
console.log(`   keys / zkir       → ${publicDst}`);