/**
 * Browser build of the compiled Student Pass contract.
 *
 * The `CompiledContract` pairs the generated TypeScript contract with the
 * witness functions for the `secretKey` private circuit input. ZK artifacts
 * (`.prover` / `.verifier` / `.bzkir`) are fetched over HTTP at proof time by
 * `HttpZkConfigProvider` / the wallet's key-material provider — there is no
 * filesystem in the browser, so `withCompiledFileAssets` is intentionally
 * omitted.
 */
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import * as StudentPass from './contract/index.js';
import { witnesses, type StudentPassPrivateState } from './witnesses.js';

export const StudentPassBrowserContract = CompiledContract.make<
  StudentPass.Contract<StudentPassPrivateState>,
  StudentPassPrivateState
>('StudentPass', StudentPass.Contract<StudentPassPrivateState>).pipe(
  CompiledContract.withWitnesses(witnesses),
  // A dummy compiled-assets path satisfies the compiled PCK registry. Real
  // proving keys come from `HttpZkConfigProvider` at proof time; the browser
  // has no filesystem, so file assets are never actually read here.
  CompiledContract.withCompiledFileAssets('__url_fetched__'),
);