import type { CheckEligibilityResult } from './ProofPanel';

export function ResultCard({ result }: { result: CheckEligibilityResult | null }) {
  if (!result) {
    return null;
  }
  return (
    <section className="card ok-card">
      <p className="card-title">
        Result: {result.active ? 'PASS — eligible' : 'NOT eligible'}
      </p>
      <p className="card-sub">
        The verdict was proven in zero-knowledge. Only this coarse outcome is on-chain.
      </p>
      <dl className="kv">
        <div>
          <dt>On-chain verdict</dt>
          <dd>{result.lastResult}</dd>
        </div>
        <div>
          <dt>Total verifications</dt>
          <dd>{result.verifications.toString()}</dd>
        </div>
        <div>
          <dt>Transaction</dt>
          <dd className="mono ellipsis">{result.txId}</dd>
        </div>
      </dl>
    </section>
  );
}