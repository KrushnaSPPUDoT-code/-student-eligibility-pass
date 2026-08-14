# Private Student Eligibility Pass (Midnight / Compact)

Zero-knowledge scholarship-eligibility checks on the **Midnight** network.

A student proves — on-chain, without revealing any academic data — that their
**CGPA, attendance and completed credits** satisfy a set of **public**
eligibility requirements published by the authority.

## What's private vs public

| Data                                                           | Visibility |
| -------------------------------------------------------------- | ---------- |
| Required CGPA / attendance / credits · result verdict          | **PUBLIC** on the ledger |
| Student's secret key (witness) commitment, owner public key    | **PUBLIC** (commitments only) |
| Student's CGPA / attendance / credits / department | **PRIVATE** — never leave the client, never stored, never logged |

Private inputs exist only as transient arguments to zero-knowledge circuits.
They are never written to the ledger, never persisted, and never rendered for
replay. **Private values are not visible outside the proof code path.**

> Note: private values are not visible outside the code.

## Repo layout

```
contracts/student_pass.compact   source contract
contracts/managed/student_pass/  compiled output (generated)
src/                             CLI + deploy scaffolding
frontend/                        Vite + React DApp
scripts/                         build tooling
```

## Quick start

```bash
npm install                # root deps
npm run frontend:install   # frontend deps

npm run compile            # compact → contracts/managed
npm test                   # circuit unit tests
```

### Deploy the contract (once per network)

```bash
npm run setup              # configures the funded wallet of the deployer
npm run deploy             # prints the contract address
```
### Deployed Contract

| Network | Contract Address |
|---|---|
| Midnight Preview | `7cddac5d8b0eb3332c51e0e94f55add1237b86576f3103e6c1949d0a54106fd0` |

**Deployment Date:** 8 August 2026

This contract is deployed on the Midnight Preview network and is used by the Student Eligibility Pass application.
Copy the printed `contract_id` into `frontend/.env.local`:

```
VITE_CONTRACT_ADDRESS=<contract_id>
```

### Run the frontend

```bash
npm run frontend:dev       # syncs circuit artifacts + runs Vite
```

The browser must have a Midnight wallet (DApp Connector API v4) installed and
unlocked, and be connected to the same network as `VITE_NETWORK` (default
`preview`).

## Frontend environment variables

All optional — see `frontend/.env.example`:

| Variable | Meaning | Default |
| --- | --- | --- |
| `VITE_NETWORK` | `preview` ǀ `preprod` | `preview` |
| `VITE_CONTRACT_ADDRESS` | deployed contract address | *(empty)* |
| `VITE_INDEXER_URL` | GraphQL endpoint of the indexer | `indexer.preview.midnight.network/api/v4/graphql` |
| `VITE_INDEXER_WS_URL` | WebSocket endpoint of the indexer | `indexer.preview.midnight.network/api/v4/graphql/ws` |
| `VITE_ZK_BASE_URL` | URL base of ZK circuit artifacts | `<base>/circuit/student_pass` |
| `VITE_PROOF_SERVER_URL` | local proof server (for wallet proving modes) | `http://localhost:6300` |

## Privacy model in the UI

- The required thresholds are rendered from the **public** ledger state.
- The form accepts the student's private values **only** for the duration of
  the proof request; they are converted to circuit inputs, never printed,
  never persisted.
- The "prove" action triggers a zero-knowledge proof via the connected wallet
  (`getProvingProvider` → balance → submit). Only the coarse verdict
  (`Eligible` / not eligible) plus the requirements/commitments land on-chain.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run compile` | compile the Compact source to `contracts/managed` |
| `npm test` | run unit tests |
| `npm run deploy` | deploy the contract |
| `frontend:sync-circuit` | copy compiled contract + keys/zkir into the frontend |
| `frontend:dev` | sync + Vite dev server |
| `frontend:build` | sync + typecheck + production build |
