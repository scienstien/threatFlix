# ThreatFlix Offline ML Workspace

**Version 1.0.0**

This workspace holds the offline UEBA training and evaluation pipeline.

Runtime responsibilities stay in `Backend/models/service/`:

- request and response contracts
- scoring service entrypoint
- trained artifact loading

Offline responsibilities live here:

- synthetic dataset generation
- feature derivation
- model training
- evaluation and export

Local Python project files live here as well:

- `pyproject.toml`
- `requirements.txt`
- `uv.lock`
- `.python-version`
- `.venv/` for local execution convenience

Generated outputs should stay under `ML/outputs/` and remain untracked.

Current runtime/training split:

- `Backend/models/service/`: FastAPI scorer, runtime contracts, loaded trained artifact
- `ML/`: offline training workspace and generated model export source

Current offline entrypoints:

- `generate_dataset.py`: deterministic raw ThreatFlix event generator
- `feature_extractor.py`: offline 21-feature UEBA derivation
- `train.py`: guarded offline ensemble trainer and artifact exporter
- `graph_evaluation/validate_wl.py`: offline GraKeL WL ranking cross-check for the TypeScript graph
  similarity implementation

## Locked Ensemble Architecture

The planned offline training pipeline is:

`raw events -> sessionization -> 21 features -> normal-only training -> detector normalization -> ensemble -> evaluation -> export`

The ensemble contains:

| Detector | Weight | Role |
| --- | ---: | --- |
| Isolation Forest | `0.45` | General multivariate anomaly baseline |
| ECOD | `0.30` | Explainable feature-tail anomalies |
| COPOD | `0.25` | Complementary copula-tail anomalies |

Every detector must expose a raw score where higher means more anomalous. The trainer stores that
detector's sorted scores from normal training sessions. A new raw score is converted to an empirical
percentile against the stored normal score reference:

`p_d = empirical_percentile(normal_training_scores_d, raw_score_d)`

The runtime-visible scores are:

`anomalyScore = 0.45 * p_iforest + 0.30 * p_ecod + 0.25 * p_copod`

`behaviorScore = round(100 * anomalyScore, 2)`

The initial anomaly threshold is `0.99`. Evaluation may recommend another explicit threshold before an
artifact is promoted. Runtime scoring never tunes the threshold.

## Explanation Contract

The bundle stores robust normal baseline statistics for every feature. Explanations rank features by their
absolute robust deviation from that baseline and report the highest contributors.

These reasons explain how the session differs from normal behavior. They are not exact causal attribution
for the ensemble.

## Export Contract

Training exports versioned artifacts under `ML/outputs/artifacts/`:

- `ueba_bundle.joblib`: fitted detectors, score normalization references, feature order, schema version,
  detector weights, anomaly threshold, and feature baseline statistics
- `ueba_metadata.json`: human-readable model/schema versions, feature order, detector configuration,
  dataset summary, evaluation summary, and creation timestamp

Promotion copies an approved export into `Backend/models/service/artifacts/`. The runtime service must
not read directly from `ML/outputs/`.

## Training Gate

The trainer refuses to fit models or write artifacts unless explicit confirmation is supplied:

```powershell
.\.venv\Scripts\python.exe train.py --confirm-training
```

Do not run this command until the generated feature datasets, threshold, and model version have been
reviewed. Running `train.py` without `--confirm-training` exits before detector fitting starts.

After training, preserve a reproducible detailed statistical review without modifying or retraining the
bundle:

```powershell
.\.venv\Scripts\python.exe review_results.py
```

This writes `ueba_statistical_review.json` and `ueba_statistical_review.md` beside the exported artifacts.
It also archives the bundle, metadata, and review under `ML/outputs/artifacts/runs/<model-version>_<timestamp>/`
so a later experiment cannot overwrite the preserved run.

## Offline Graph Similarity Validation

This is validation only. It does not train or serve the runtime graph similarity layer.

```powershell
cd ..\Backend
npm run export:graph-validation

cd ..\ML
.\.venv\Scripts\python.exe graph_evaluation\validate_wl.py
```

The exporter writes canonical graphs plus TypeScript rankings to
`ML/graph_evaluation/inputs/corpus.json`. The validator preserves GraKeL ranking and score-distribution
comparisons under `ML/graph_evaluation/outputs/`.
