# ThreatFlix Runtime ML Service

**Version 1.0.0**

This directory is the runtime-only UEBA scoring service used by the Bun backend.

It contains:

- `app.py`: FastAPI scoring API
- `contracts.py`: runtime request and response contracts
- `test_contracts.py`, `test_app.py`: runtime contract and scoring tests
- `artifacts/ueba_bundle.joblib`: promoted trained UEBA bundle loaded at startup
- `pyproject.toml`, `requirements.txt`, `uv.lock`, `.python-version`: local runtime environment metadata

It does not contain offline training or dataset generation code.

Offline ML work now lives under `ML/`.

## Runtime Artifact Contract

The planned runtime artifact is promoted from an approved offline export and contains:

- fitted Isolation Forest, ECOD, and COPOD detectors
- normal training score references for empirical-percentile normalization
- exact ordered 21-feature schema and schema version
- locked detector weights and deployed anomaly threshold
- feature baseline statistics for explanations

The accompanying metadata file records the model version, configuration, training dataset summary, and
evaluation summary.

The runtime service:

- loads artifacts only at startup
- never trains, retrains, tunes, or overwrites artifacts
- validates schema version and feature order before scoring
- returns normalized detector scores, ensemble anomaly score, behavior score, and feature reasons
- fails open to deterministic-only behavior when ML is unavailable or incompatible

The service only scores sessions supplied from an existing deterministic investigation. It must not create
investigations independently.
