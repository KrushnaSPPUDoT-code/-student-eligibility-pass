import { useCallback, useEffect, useState } from 'react';
import type { StudentLedger } from '../lib/contractClient';
import { readPublicLedger } from '../lib/contractClient';

export function RequirementsCard({
  indexerUrl,
  contractAddress,
}: {
  indexerUrl: string;
  contractAddress: string;
}) {
  const [ledger, setLedger] = useState<StudentLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLedger(await readPublicLedger(indexerUrl, contractAddress));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [indexerUrl, contractAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="card">
      <p className="card-title">Published requirements</p>
      <p className="card-sub">
        Public eligibility gates (anyone can see these). Your record stays private.
      </p>

      {loading && <p className="hint">Reading latest public state from the indexer…</p>}
      {error && <p className="error-box">{error}</p>}

      {ledger && (
        <dl className="kv">
          <div>
            <dt>Required CGPA</dt>
            <dd>
              {formatCgpa(ledger.requiredCgpa)} <small>out of 10</small>
            </dd>
          </div>
          <div>
            <dt>Required attendance</dt>
            <dd>{formatAttendance(ledger.requiredAttendance)}</dd>
          </div>
          <div>
            <dt>Required credits</dt>
            <dd>{ledger.requiredCredits.toString()}</dd>
          </div>
          <div>
            <dt>Verifications</dt>
            <dd>{ledger.verifications.toString()}</dd>
          </div>
          <div>
            <dt>Last result</dt>
            <dd>{ledger.lastResult.is_some ? ledger.lastResult.value : 'not yet evaluated'}</dd>
          </div>
        </dl>
      )}

      <button className="btn ghost" onClick={() => void load()} disabled={loading}>
        Refresh
      </button>
    </section>
  );
}

function formatCgpa(v: bigint): string {
  return `${v / 1000n}.${(v % 1000n).toString().padStart(3, '0')}`;
}

function formatAttendance(v: bigint): string {
  return `${(v / 10n).toString()}.${(v % 10n).toString()}%`;
}