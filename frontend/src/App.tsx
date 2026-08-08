import { useEffect, useState } from 'react';
import { CONTRACT_ADDRESS, INDEXER_URL, INDEXER_WS_URL, NETWORK_LABEL, ZK_BASE_URL } from './env';
import { useMidnight } from './hooks/useMidnight';
import { WalletConnect } from './components/WalletConnect';
import { RequirementsCard } from './components/RequirementsCard';
import { ProofPanel } from './components/ProofPanel';
import { ResultCard } from './components/ResultCard';
import type { CheckEligibilityResult } from './components/ProofPanel';
import type { StudentPassClient } from './lib/contractClient';

export function App() {
  const wallet = useMidnight();
  const [client, setClient] = useState<StudentPassClient | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckEligibilityResult | null>(null);

  // (Re)build the wallet-driven contract client once a stable connection exists.
  // The client module is imported dynamically: loading it at startup would pull
  // the Level private-state provider (and its Node-only `level` deps) into the
  // initial bundle, crashing the page before React renders. Here it is fetched
  // only when a wallet is connected and the client is actually needed.
  useEffect(() => {
    let cancelled = false;
    const api = wallet.api;
    if (api && CONTRACT_ADDRESS) {
      setClientError(null);
      void import('./lib/contractClient')
        .then(({ createStudentPassClient }) =>
          createStudentPassClient({
            api,
            contractAddress: CONTRACT_ADDRESS,
            indexerUrl: INDEXER_URL,
            indexerWsUrl: INDEXER_WS_URL,
            zkBaseUrl: ZK_BASE_URL,
            network: NETWORK_LABEL,
          }),
        )
        .then((c) => {
          if (!cancelled) setClient(c);
        })
        .catch((e) => {
          if (!cancelled) setClientError(e instanceof Error ? e.message : String(e));
        });
    } else {
      setClient(null);
    }
    return () => {
      cancelled = true;
    };
  }, [wallet.api]);

return (
    <main className="app">
      <div className="hero">
        <h1>Private Student Eligibility Pass</h1>
        <p className="subtitle">
          Prove you meet the published CGPA / attendance / credit thresholds on the{' '}
          {NETWORK_LABEL} network — without ever revealing your academic record.
        </p>
      </div>

      <div className="layout">
        <div className="col col-wallet">
          <WalletConnect wallet={wallet} />
        </div>
        <div className="col col-main">
          {CONTRACT_ADDRESS ? (
            <>
              <RequirementsCard indexerUrl={INDEXER_URL} contractAddress={CONTRACT_ADDRESS} />
              <ProofPanel wallet={wallet} client={client} onResult={setResult} />
              {clientError && (
                <section className="card warn-card">
                  <p className="card-title">Contract client not ready</p>
                  <p className="card-sub">{clientError}</p>
                </section>
              )}
              <ResultCard result={result} />
            </>
          ) : (
            <section className="card warn-card">
              <p className="card-title">Contract address not configured</p>
              <p className="card-sub">
                Add <code>VITE_CONTRACT_ADDRESS</code> to <code>frontend/.env.local</code> with the
                address of a deployed Student Pass contract (see README).
              </p>
            </section>
          )}
        </div>
      </div>

      <footer className="foot">
        <p>
          Privacy model — everything a third party can read on-chain is: the requirements, a
          one-way commitment to your secret key, and the coarse outcome of each check. Your CGPA,
          attendance, credits and department never touch the ledger.
        </p>
      </footer>
    </main>
  );
}