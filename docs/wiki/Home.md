# ThreatFlix V1 Technical Wiki

ThreatFlix V1 is an explainable identity-threat investigation system. Its core design is deliberately conservative: deterministic evidence decides whether an investigation exists; behavioral ML only adjusts priority; graph mathematics retrieves structurally similar history; and the LLM explains frozen evidence without becoming an authority.

This page is the technical wiki for the current V1 architecture. It explains the detection math, UEBA logic, graph similarity, LLM boundaries, evaluation evidence, demo path, and production roadmap.

---

## 1. Authority Model

ThreatFlix assigns one responsibility to each reasoning layer.

| Layer | Question answered | Authority boundary |
| --- | --- | --- |
| Raw telemetry | What was observed? | Ground-truth input only. |
| Deterministic detection | Does observed evidence justify an investigation? | Primary authority. No deterministic evidence means no investigation. |
| UEBA / ML | How unusual is an already-grounded session? | Bounded score refinement only. It cannot create a case. |
| Graph similarity | Which previous incidents have a similar structure? | Historical retrieval only. It cannot prove attribution. |
| LLM interpretation | How should an analyst understand and respond? | Non-authoritative explanation over frozen context. |

```text
Raw identity events
  -> sessionization
  -> deterministic rule hits
  -> correlated clusters
  -> attack-chain edges
  -> deterministic score D
       +-> UEBA score M on grounded sessions
       +-> provenance graph and canonical graph fingerprint
  -> bounded confidence fusion
  -> persisted investigation
       +-> similar incident retrieval
       +-> frozen LLM report and SOC chat
```

The system should be presented as an evidence-grounded investigation workflow, not as autonomous AI detection.

---

## 2. Data Lifecycle

1. Identity events enter the backend with project scope, user, IP, service, timestamp, session, metadata, severity, and tags.
2. Events are sorted chronologically and sessionized by explicit session ID when present, otherwise by an identity fallback key.
3. Deterministic rules emit evidence objects with exact supporting event IDs, stage, confidence, entity keys, timestamps, and candidate ATT&CK techniques.
4. Evidence findings are clustered by strong entity continuity and bounded time proximity.
5. Attack-chain edges are built only when entity continuity, timing, stage compatibility, and rule support are positive.
6. The best deterministic cluster is scored. If no deterministic investigation is supported, analysis ends safely.
7. UEBA is invoked only for sessions related to deterministic evidence.
8. ML applies a bounded correction to deterministic confidence.
9. A raw provenance graph is persisted for analyst inspection.
10. An identity-stripped canonical graph fingerprint is persisted for similarity search.
11. A background worker freezes the investigation context and asks a local Ollama model for structured interpretation.
12. The frontend shows raw telemetry and deterministic evidence before UEBA, graph comparison, report, and chat.

### Failure behavior

| Failure | Investigation exists? | Safe behavior |
| --- | --- | --- |
| No deterministic evidence | No | ML and LLM cannot invent a case. |
| UEBA sidecar unavailable | Yes, if deterministic evidence exists | Investigation remains deterministic-only. |
| Graph lookup fails | Yes | Similar incident panel is empty/unavailable. |
| Ollama unavailable | Yes | Report job retries or fails independently. |
| Malformed ML response | Yes | Response validation rejects it and uses deterministic-only scoring. |

---

## 3. Deterministic Detection Mathematics

The deterministic layer is the core of ThreatFlix. It converts raw telemetry into an inspectable attack claim.

### 3.1 Sessionization

The preferred session key is the explicit session ID. If no session ID exists, ThreatFlix falls back to an identity key.

```text
session_key(e) = "session:" + e.sessionId, if sessionId exists
session_key(e) = "identity:" + e.ip + ":" + e.user, otherwise
```

Within a key, a new session begins when the idle gap exceeds 30 minutes. This preserves continuity for explicit sessions while preventing unrelated activity from being merged indefinitely.

### 3.2 Rule evidence

Rules emit evidence, not just booleans. Each finding carries the rule ID, weight, human-readable description, supporting event IDs, attack stage, confidence, entity keys, timestamps, and ATT&CK candidates.

| Rule | Threshold | Weight | Stage / ATT&CK |
| --- | --- | ---: | --- |
| Brute force | At least 10 failures in 5 minutes for same IP:user:service | 40 | `access_pressure` / T1110 |
| Password spray | At least 10 distinct users from one IP in 15 minutes | 30 | `access_pressure` / T1110.003 |
| Credential stuffing | At least 10 users, 3 IPs, and 15 user-IP pairs in 15 minutes | 35 | `access_pressure` / T1110.004 |
| Success after failure | At least 5 failures before a success in 10 minutes | 28 | `access_success` / T1078 |
| MFA bypass pattern | At least 3 MFA failures followed by MFA success, login success, or MFA disable in 15 minutes | 30 | `access_success` / T1556.006 |
| MFA disabled | Any MFA disable event | 24 | `persistence` / T1556.006 |
| Privilege change | Role change, permission grant, or privilege escalation | 26 | `privilege_change` / T1098 |
| Persistence establishment | API-key creation or password reset | 24 | `persistence` / T1098.001 |
| Account access removal | Permission revocation | 22 | `privilege_change` / T1531 |
| Data exfiltration | Any data export | 32 | `objective_action` / T1041 |

A rule weight is mapped to a bounded confidence-like value:

```text
confidence_rule(w) = 1 / (1 + exp(-0.08 * (w - 50)))
```

This is a monotonic heuristic, not a learned probability.

### 3.3 Correlation clustering

ThreatFlix uses union-find clustering over rule findings. Two findings can join only when they have a strong entity link and a bounded time gap.

```text
link(f_i, f_j) = strong_entity_overlap(f_i, f_j) AND gap_minutes(f_i, f_j) <= allowed_gap
```

Allowed gap is 120 minutes for the same session and 30 minutes otherwise. Same-service-only overlap is intentionally rejected because common services can create broad false joins.

Union-find gives efficient transitive grouping: if A links to B and B links to C, all three enter the same cluster even if A and C are not directly linked.

### 3.4 Attack stage grammar

Current stage order:

```text
access_pressure -> access_success -> persistence -> privilege_change -> objective_action
```

Compatibility values:

| Transition type | Stage score |
| --- | ---: |
| Forward transition | 1.0 |
| Same-stage transition | 0.5 |
| One-step reverse transition | 0.1 |
| Larger reverse transition | 0.0 and rejected |

### 3.5 Chain-edge score

Edges are created only for chronological finding pairs with positive entity continuity and stage compatibility.

```text
transitionScore = clamp01(0.35 * entity + 0.25 * time + 0.25 * stage + 0.15 * support)
```

Components:

| Component | Meaning |
| --- | --- |
| `entity` | Continuity of user, IP, service, or session. Same session is strongest; same user alone is weaker. |
| `time` | `exp(-0.05 * minutesBetween)`, so immediate transitions are strongest and distant transitions decay. |
| `stage` | Compatibility from the attack stage grammar. |
| `support` | Geometric mean of the two rule confidences: `sqrt(conf_from * conf_to)`. |

ATT&CK labels cannot create an edge. Labels only enrich edges that already exist from entities, time, stage, and evidence.

### 3.6 Deterministic score

```text
D = clamp(R + C + B + T + K + X - P, 0, 100)
```

| Term | Cap | Logic |
| --- | ---: | --- |
| `R` rule strength | 45 | Sum of strong evidence, with overlap suppression so duplicate rules cannot inflate the score. |
| `C` chain coherence | 25 | `4 * stageCount + 3 * transitionCount + 5 * averageEdge`. |
| `B` blast radius | 15 | Logarithmic growth across users, IPs, services, and sessions. |
| `T` temporal compression | 15 | Rewards critical stages occurring in a compact window. |
| `K` ATT&CK progression | 10 | Supported technique transitions multiplied by grounded edge quality. |
| `X` CAPEC alignment | 10 | Best attack-pattern template match. |
| `P` penalties | 20 | Reduces single weak findings, weak average edges, and highly overlapping evidence. |

Rule-overlap suppression:

```text
overlap(f_i, f_j) = |events_i intersect events_j| / min(|events_i|, |events_j|)
```

If overlap is at least 0.70, the weaker contribution is reduced to 35%. If overlap is between 0.40 and 0.70, contribution is reduced proportionally.

Blast radius:

```text
B = clamp(
  2log2(1+users) + 2log2(1+ips) + 1.5log2(1+services) + log2(1+sessions),
  0,
  15
)
```

Temporal compression:

```text
T = clamp(2 * criticalSteps + 8 * exp(-0.05 * durationMinutes), 0, 15)
```

ATT&CK transition support:

```text
A_eff(i,j) = structuralPrior(i,j) * transitionScore(i,j)
K = 10 * average(A_eff for supported chain edges)
```

CAPEC template score:

```text
templateScore = 0.35 * stageCoverage
              + 0.30 * techniqueCoverage
              + 0.20 * orderQuality
              + 0.15 * edgeQuality
X = 10 * max(templateScore)
```

---

## 4. UEBA / Behavioral ML Mathematics

UEBA answers one narrow question: how unusual is this already-grounded identity session relative to the baseline?

### 4.1 Fixed 21-feature vector

| Group | Features |
| --- | --- |
| Current session | `eventCount`, `failedLogins`, `successfulLogins`, `mfaFailures`, `privilegedEvents`, `apiKeyCreations`, `dataExports`, `durationSeconds`, `failuresPerMinute` |
| Behavior flags and time | `failureToSuccessFlag`, `hourSin`, `hourCos`, `offHoursFlag`, `newIpForUserFlag` |
| Prior context | `distinctIpsForUser24h`, `distinctUsersForIp24h`, `apiKeysForUser24h`, `dataExportsForUser24h`, `privilegeChangesForUser24h`, `userFailureRate24h`, `tenantFailureRate24h` |

Cyclical time encoding prevents 23:00 and 00:00 from looking far apart numerically:

```text
theta = 2*pi*h/24
hourSin = sin(theta)
hourCos = cos(theta)
```

V1 currently assumes Indian Standard Time and treats activity outside 08:00-18:00 IST as off-hours.

### 4.2 Detector ensemble

| Detector | Weight | Role |
| --- | ---: | --- |
| Isolation Forest | 0.45 | Random partition trees isolate rare multivariate combinations quickly. |
| ECOD | 0.30 | Empirical tail extremeness by feature. |
| COPOD | 0.25 | Copula-based tail probability for distributional complementarity. |

Raw detector scores are calibrated to empirical percentiles over normal training sessions:

```text
p_d(x) = count(reference_score_d <= raw_score_d(x)) / |reference_d|
```

Final ensemble:

```text
M = 0.45*p_isolationForest + 0.30*p_ECOD + 0.25*p_COPOD
behaviorScore = round(100*M, 2)
isAnomaly = (M >= 0.99)
```

The runtime sidecar loads a promoted artifact. It does not train, retrain, or silently retune the threshold.

### 4.3 Explanation math

The model bundle stores feature medians, median absolute deviations, and quartiles. Runtime explanations use robust deviations:

```text
spread_j = MAD_j, if MAD_j > 0
spread_j = max(|median_j|, 1), otherwise

deviation_j = |x_j - median_j| / spread_j
contribution_j = deviation_j / max_k(deviation_k)
```

The top features explain behavioral deviation. They are not causal attributions for the full ensemble.

### 4.4 UEBA limitations

Current UEBA evidence is useful but not production proof:

- Training and evaluation are synthetic.
- Only five synthetic attack sessions exist in the preserved evaluation.
- Several baseline features are constant, reducing distributional richness.
- Baselines are not yet mature per-user, per-role, per-device, or per-tenant profiles.
- Percentile scores are ranks against a baseline, not attack probabilities.
- The `0.99` threshold still produces too many false positives if ML were allowed to alert independently.

ThreatFlix avoids the largest operational risk by never letting UEBA independently create investigations.

---

## 5. Bounded Deterministic-ML Fusion

Let deterministic score be `D` in `[0,100]` and UEBA anomaly score be `M` in `[0,1]`.

```text
m = 100*M - 50
maxDelta(D) = max(5, 30 - 0.25*D)
delta_ml = clamp(m, -maxDelta(D), maxDelta(D))
fusedScore = clamp(D + delta_ml, 0, 100)
```

| Deterministic score D | Maximum ML movement | Interpretation |
| ---: | ---: | --- |
| 20 | 25 | Weak deterministic evidence can be meaningfully reprioritized, but not turned into a critical case. |
| 50 | 17.5 | Moderate evidence remains primary. |
| 80 | 10 | Strong evidence gets only a small refinement. |
| 100 | 5 | Conclusive deterministic evidence is nearly immovable. |

Design consequence: even a perfect anomaly score cannot create a case or override a strong deterministic chain.

---

## 6. Graph Similarity Mathematics

ThreatFlix has two graphs:

1. Raw provenance graph for analyst inspection.
2. Identity-stripped canonical graph for structural similarity.

### 6.1 Raw provenance graph

For each event, the graph contains event, user, IP, service, and optional session nodes. Directed edges encode:

```text
session -contains-> event
user    -performed-> event
ip      -originated-> event
event   -targeted-> service
```

This graph preserves literal evidence and is used in the analyst UI.

### 6.2 Canonicalization

Canonicalization removes literal identities while preserving typed relationships, event order, rule support, stages, techniques, multiplicity, and coarse timing.

Examples:

```text
real user: priya.sharma@acme-demo.in -> entity:user:0000
real IP: 203.0.113.42              -> entity:ip:0000
```

Timing gaps are bucketed:

| Bucket | Gap |
| --- | --- |
| `immediate` | <= 1 minute |
| `short` | <= 5 minutes |
| `medium` | <= 30 minutes |
| `long` | > 30 minutes |

This enables attacks against different users and IPs to match by structure rather than identity.

### 6.3 Weisfeiler-Lehman relabeling

At iteration zero, each node has a semantic label. Each iteration hashes the current label plus sorted typed directed neighbor labels.

```text
L_0(v) = initial semantic label

L_(t+1)(v) = HASH(
  L_t(v) || SORT(
    { "in:"  + edgeType(u,v) + ":" + L_t(u) }
    union
    { "out:" + edgeType(v,w) + ":" + L_t(w) }
  )
)
```

- Iteration 0 captures semantics.
- Iteration 1 captures local neighborhoods.
- Iteration 2 captures extended attack structure.

Each iteration produces a histogram of labels.

### 6.4 TF-IDF and cosine similarity

Repeated events should matter without dominating the fingerprint, so term frequency is sublinear:

```text
tf(c) = 1 + log(c), if c > 0
```

When enough compatible tenant fingerprints exist, inverse document frequency is used:

```text
idf(label) = log((N + 1) / (df(label) + 1)) + 1
weighted(label) = tf(count(label)) * idf(label)
```

Cosine similarity compares weighted histogram vectors:

```text
cos(x,y) = (x dot y) / (||x|| * ||y||)
```

Final score:

```text
similarity = 0.20 * semantic
           + 0.35 * localStructure
           + 0.45 * extendedStructure
```

Relation bands:

| Score | Band |
| ---: | --- |
| >= 0.45 | Strong |
| >= 0.30 and < 0.45 | Related |
| < 0.30 | Weak, hidden by default |

Similarity means structural resemblance only. It does not prove same attacker, shared infrastructure, or causation.

---

## 7. LLM Interpretation and SOC Chat

The LLM is isolated from detection authority.

It cannot:

- create investigations,
- change deterministic confidence,
- choose authoritative severity,
- create evidence,
- alter MITRE mapping,
- change UEBA scores,
- change graph links.

It receives a frozen context containing bounded telemetry, deterministic evidence, chain edges, UEBA summary, raw graph context, and limited graph-similarity matches.

Safety boundaries:

- telemetry and metadata are treated as untrusted data, never instructions;
- oversized metadata is truncated;
- latest telemetry is bounded;
- only a limited number of UEBA sessions and similar incidents enter context;
- similar incidents include bounded explanations, not raw candidate reports or chat transcripts;
- structured JSON output is validated before persistence.

Reports should include executive summary, likely incident, chronology, evidence assessment, recommended actions, uncertainty, and open questions. Chat answers should cite source IDs and preserve uncertainty.

---

## 8. Current Evaluation Evidence

| Area | Current result | Correct interpretation |
| --- | --- | --- |
| Backend tests | 77 passing tests with 239 assertions | Good regression coverage for current backend logic; not a load/security/frontend proof. |
| UEBA synthetic ranking | Precision@5, Recall@5, ROC-AUC, and PR-AUC all equal 1.0 | The five injected synthetic attacks ranked above normal sessions; not production accuracy. |
| UEBA threshold 0.99 | 5 true positives, 57 false positives, 20.16 false positives per 1,000 normal sessions | Ranking is strong on synthetic data, but the threshold is too noisy for independent ML alerting. |
| Graph validation | Pearson pair-score correlation 0.9434; mean Spearman 0.72; top-1 agreement 0.60 | Promising agreement with an independent WL direction, but corpus is tiny. |
| Demo similarity | Different-identity full takeover ranks first at 0.4781; partial precursor ranks second at 0.3517 | Graph layer retrieves structurally related incidents without requiring same user or IP. |

Scientific boundary: current evidence validates architecture, reproducibility, and pipeline behavior. It must not be marketed as mature production detection coverage.

---

## 9. Recommended Demo Flow

The strongest demo narrative is: fragmented identity telemetry becomes a grounded investigation, then ML, graph retrieval, and LLM interpretation help analysts without taking control.

1. State the authority model: deterministic evidence creates investigations; ML refines; graphs retrieve; LLM explains.
2. Open the attacked demo identity and show raw telemetry first.
3. Show failures, success, MFA disable, privilege escalation, API-key creation, and data export.
4. Show deterministic rule evidence and attack-chain construction.
5. Explain rule thresholds, shared entities, timing, stage grammar, and score components.
6. Show UEBA as bounded behavioral refinement, not detection authority.
7. Open the raw graph explorer and trace user, IP, session, event, service, and metadata links.
8. Compare a different-user/different-IP historical takeover and explain WL/cosine structural similarity.
9. Show the LLM report and ask a focused SOC-chat question, such as: `What should I contain first, and which evidence supports that?`
10. Close with failure isolation: ThreatFlix remains useful when ML or Ollama is unavailable.

Avoid saying `AI detects everything`, `AUC 1.0 means production-ready`, or `similarity proves the same attacker`.

---

## 10. Production Roadmap

### Phase 1: Demo and pilot hardening

- One-command startup, health checks, seed reset, and demo preflight.
- Frontend smoke tests for login, investigation selection, topology, comparison, report, and chat.
- Clean UI text and encoding artifacts.
- Visible service/model version panel.
- Event-schema validation and telemetry-quality warnings.

### Phase 2: Real-data shadow pilot

- Build one or two identity-provider connectors.
- Run deterministic and UEBA layers in shadow mode.
- Collect analyst labels, benign exceptions, and missed-incident examples.
- Measure Precision@K, false positives per 1,000 sessions, time-to-triage, escalation quality, and analyst trust.
- Expand graph corpus with labeled similar/unrelated pairs.

### Phase 3: Production platform foundations

- Durable queues and scalable persistence.
- Containerized backend, ML service, and optional local LLM.
- SSO, RBAC, audit logs, encryption policy, secrets management, and retention controls.
- Observability for ingestion lag, rule hits, model latency, drift, LLM failure, graph indexing, and cost.
- Detection-content versioning, replay testing, approval, rollback, and customer overrides.

### Phase 4: Advanced intelligence

- Learn ATT&CK transition probabilities from accepted investigations using smoothed priors.
- Add user, peer-group, role, device, service, and tenant baselines.
- Add approximate-nearest-neighbor retrieval for graph fingerprints.
- Calibrate learned similarity against analyst pair labels.
- Add approved response integrations, with no autonomous destructive action by default.

The highest-value next move is not a more complex model. It is real telemetry, analyst labels, and measured operational lift.

---

## 11. Product and Commercial Notes

ThreatFlix has a strong early commercial story as a bounded design-partner pilot. The pitch should emphasize trust, evidence traceability, and analyst time savings rather than autonomous AI detection.

Useful ROI equation:

```text
Annual analyst hours saved = cases_per_day * minutes_saved_per_case / 60 * workdays_per_year
Annual labor value = annual_hours_saved * loaded_analyst_hourly_cost
ROI = (annual_benefit - annual_cost) / annual_cost
```

Illustrative example from the dossier:

```text
40 cases/day * 12 minutes saved / 60 * 250 workdays = 2,000 hours saved/year
2,000 * $65/hour = $130,000 annual labor value
```

This is a planning model, not a guaranteed customer outcome. A pilot should measure minutes saved, cases affected, escalation quality, and expected risk reduction.

---

## 12. Engineering Source Map

| Concern | Primary implementation area |
| --- | --- |
| Analysis orchestration | `Backend/src/ai/analyzer.ts` |
| Rules | `Backend/src/ai/evidenceEngine.ts` |
| Clustering and chain | `deterministic/clustering.ts`, `edges.ts`, `stages.ts` |
| Deterministic score | `deterministic/scoring.ts`, `attackTransitions.ts`, `capecTemplates.ts` |
| UEBA features | `uebaFeatureExtractor.ts`, `ML/feature_extractor.py` |
| UEBA training | `ML/train.py`, `ueba_metadata.json`, `ueba_statistical_review.md` |
| UEBA runtime | `Backend/models/service/app.py`, `mlClient.ts`, `uebaScoring.ts` |
| Graph similarity | `canonicalGraph.ts`, `wlFingerprint.ts`, `similarity.ts`, `service.ts` |
| Graph validation | `graph_similarity_evaluation.json`, `grakel_wl_validation.md` |
| LLM interpretation | `llmWorker.ts`, `llmContext.ts`, `ollamaProvider.ts` |
| Persistence/API | `database.ts`, repositories, routes |
| Frontend | `InvestigationWorkspace.tsx`, `IncidentGraphExplorer.tsx` |

---

## 13. Glossary

| Term | ThreatFlix meaning |
| --- | --- |
| Deterministic evidence | Explicit rule evidence over observed telemetry; the only authority that can create a V1 investigation. |
| UEBA | User and Entity Behavior Analytics; a bounded anomaly score for grounded sessions. |
| ATT&CK | Technique mapping and transition support after evidence exists. |
| CAPEC | Attack-pattern template alignment after a grounded chain exists. |
| Provenance graph | Raw analyst-visible user/IP/session/event/service graph. |
| Canonical graph | Identity-stripped graph used for structural comparison. |
| WL fingerprint | Weisfeiler-Lehman neighborhood relabeling histogram. |
| Cosine similarity | Vector-angle comparison over WL histograms. |
| Frozen context | Persisted report input that prevents LLM interpretation from silently changing source evidence. |

---

## 14. V1 Verdict

ThreatFlix V1 is strongest as an architecture for trustworthy AI-assisted security investigation. Its defensible innovation is the disciplined composition of deterministic evidence, bounded behavioral scoring, identity-independent graph retrieval, and non-authoritative language-model interpretation.

It is ready for a strong demo and a carefully scoped design-partner pilot. It is not ready for broad production-performance claims until real telemetry, analyst labels, and production platform controls are in place.
