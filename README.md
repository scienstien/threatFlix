# ThreatFlix

**Version 1.0.0**

ThreatFlix is an explainable identity-threat detection and investigation platform. It turns raw identity
telemetry into deterministic investigations, enriches them with behavioral anomaly scoring, compares
their attack structure against historical incidents, and gives SOC analysts a bounded local-LLM report
and chat interface.

The central V1 design rule is:

> Deterministic evidence creates investigations. ML, graph similarity, and the LLM may refine and
> explain them, but cannot independently create an investigation.

## What V1 Includes

- Deterministic identity-threat rules, clustering, attack-chain construction, and risk scoring
- UEBA scoring using a locked 21-feature Isolation Forest + ECOD + COPOD ensemble
- Weisfeiler-Lehman incident-graph fingerprints and cross-incident similarity retrieval
- Local Ollama interpretation reports and source-grounded analyst chat
- React investigation workspace with raw telemetry, evidence, graph exploration, UEBA, and reports
- Reproducible seeded demo customer with normal history, an active account takeover, and comparable incidents
- SDK and legacy demo runner for event ingestion examples

## Authority Model

```text
Raw telemetry
  -> sessionization and deterministic evidence rules
  -> deterministic investigation and attack chain
  -> bounded UEBA score refinement
  -> graph fingerprint and historical similarity
  -> frozen LLM context, report, and SOC chat
  -> analyst-facing investigation workspace
```

Failure of the ML service, graph layer, or Ollama does not discard deterministic findings.

## Repository Layout

| Path | Responsibility |
| --- | --- |
| `Backend/` | Bun + Express API, SQLite persistence, deterministic engine, graph layer, LLM integration |
| `Backend/models/service/` | Runtime-only FastAPI UEBA scoring service and promoted model artifact |
| `FrontEnd/` | React 19 + Vite analyst dashboard and investigation workspace |
| `ML/` | Offline reproducible UEBA training, evaluation, review, and graph validation |
| `SDK/` | TypeScript event-ingestion SDK |
| `Demo/` | Legacy standalone attack scenario runner |

## Core Detection Logic

### Deterministic Layer

The evidence engine recognizes identity attack signals such as brute force, password spraying,
credential stuffing, success-after-failure, MFA bypass, MFA disablement, privilege changes,
persistence, account access removal, and data exfiltration.

Events are sessionized and clustered using shared entities and bounded time windows. Evidence is ordered
into attack stages:

```text
access_pressure -> access_success -> persistence -> privilege_change -> objective_action
```

The deterministic score is:

```text
D = clamp(ruleScore + chainScore + blastRadius + temporalScore
          + ATT&CKScore + CAPECScore - penalties, 0, 100)
```

### UEBA Layer

The backend derives a fixed 21-feature session vector using only prior context. V1 assumes users are
based in Indian Standard Time and treats activity outside 08:00-18:00 IST as off-hours.

The promoted ensemble is:

```text
anomalyScore =
    0.45 * percentile(IsolationForest)
  + 0.30 * percentile(ECOD)
  + 0.25 * percentile(COPOD)
```

The V1 anomaly threshold is `0.99`. ML refinement is bounded so it cannot overwhelm deterministic
evidence:

```text
mlDeltaLimit = max(5, 30 - 0.25 * deterministicScore)
fusedScore   = clamp(deterministicScore + boundedMlDelta, 0, 100)
```

### Graph Similarity Layer

Each investigation is represented as a directed, typed incident graph. Literal identities are removed
from its canonical fingerprint so structurally similar attacks against different users and IP addresses
can still match.

The graph layer applies Weisfeiler-Lehman relabeling, sublinear term frequency, optional TF-IDF, and
cosine similarity over cumulative graph-feature histograms:

```text
similarity = 0.20 * semantic + 0.35 * local + 0.45 * extended
```

Similarity is evidence of structural resemblance, not attacker attribution.

### LLM Interpretation Layer

The local Ollama model receives a bounded, persisted context containing deterministic findings, selected
raw telemetry, UEBA output, and similar incidents. It produces a structured incident report and answers
analyst questions with source IDs. It cannot change investigation scores or create investigations.

## Quick Start

### Prerequisites

- Bun
- Node.js/npm
- Python 3.12 and `uv`
- Ollama, if report generation and SOC chat are required

### 1. Backend

```powershell
cd Backend
npm install
Copy-Item .env.example .env
```

Set a non-default `JWT_SECRET` in `Backend/.env`, then:

```powershell
npm run seed:demo
npm run dev
```

The API runs at `http://127.0.0.1:8000`.

### 2. Runtime UEBA Service

```powershell
cd Backend/models/service
uv sync
uv run uvicorn app:app --host 127.0.0.1 --port 8001
```

The service loads `artifacts/ueba_bundle.joblib` at startup and exposes:

- `GET /health`
- `POST /score`

### 3. Frontend

```powershell
cd FrontEnd
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/dashboard`.

### 4. Optional Ollama Reports

```powershell
ollama serve
ollama pull gemma3n:e2b
```

Set `OLLAMA_MODEL=gemma3n:e2b` in `Backend/.env`.

## Demo Customer

Seed the reproducible V1 demo with:

```powershell
cd Backend
npm run seed:demo
```

| Field | Value |
| --- | --- |
| Login | `demo.customer@threatflix.local` |
| Password | `ThreatFlixDemo!2026` |
| Project | `demo-customer-acme-india` |
| Victim identity | `priya.sharma@acme-demo.in` |

The seed recreates normal user history, a multi-stage takeover, four historical comparison incidents,
graph fingerprints, UEBA enrichment when available, and a completed example report/chat thread.

## Recommended Demo Flow

1. Open the primary investigation and begin with raw telemetry.
2. Show the deterministic evidence and observed attack chain.
3. Explain that deterministic logic created the investigation.
4. Show UEBA as bounded behavioral refinement, including its top feature deviations.
5. Open the animated raw-node graph and explain the attack topology.
6. Compare the incident with the structurally similar historical takeover.
7. Read the interpretation report and ask one focused SOC-chat question.
8. Explain that optional intelligence layers fail open without losing the deterministic case.

## Useful Backend Commands

```powershell
npm test
npm run typecheck
npm run seed:demo
npm run backfill:graph
npm run evaluate:graph
npm run export:graph-validation
```

## Offline ML Workflow

Offline training is intentionally separated from runtime scoring:

```powershell
cd ML
uv sync
uv run python generate_dataset.py
uv run python train.py --confirm-training
uv run python review_results.py
```

Training output remains under `ML/outputs/` and is not committed. Promote only an explicitly reviewed
`ueba_bundle.joblib` into `Backend/models/service/artifacts/`.

## V1 Evaluation Boundary

The preserved UEBA evaluation is synthetic and reproducible. It is useful for validating pipeline logic,
not for claiming production detection performance. Current limitations include synthetic training data,
fixed IST work-hour assumptions, SQLite single-node persistence, batch-trained UEBA models, and a local
Ollama runtime without enterprise model governance.

## API Surface

All backend routes use the `/api` prefix.

| Area | Examples |
| --- | --- |
| Health | `GET /api/health` |
| Events | `POST /api/events`, `GET /api/events/latest` |
| Alerts | `GET /api/alerts`, `PATCH /api/alerts/:id` |
| Investigations | `GET /api/investigations`, `GET /api/investigations/:id` |
| Similarity | `GET /api/investigations/:id/similar` |
| Reports | `GET /api/investigations/:id/report`, `POST /api/investigations/:id/report/regenerate` |
| SOC chat | `GET /api/investigations/:id/chat`, `POST /api/investigations/:id/chat` |
| Administration | `/api/admin`, `/api/apikeys`, `/api/webhooks`, `/api/auth` |

## Release Notes: 1.0.0

V1 establishes the complete explainable investigation architecture: deterministic authority, bounded UEBA
refinement, cross-incident graph similarity, local LLM interpretation, a reproducible demo tenant, and a
redesigned analyst workspace.

## License

MIT
