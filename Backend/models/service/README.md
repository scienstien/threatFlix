# ThreatFlix UEBA Package

**Version 0.0.1**

This directory contains the first packaged release of the ThreatFlix UEBA scoring runtime.

It contains:

- `threatflix_ueba/`: installable Python package
- `app.py`: compatibility entrypoint for the local FastAPI service
- `contracts.py`: compatibility re-export for local runtime contracts
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

The packaged runtime:

- loads artifacts only at startup
- never trains, retrains, tunes, or overwrites artifacts
- validates schema version and feature order before scoring
- returns normalized detector scores, ensemble anomaly score, behavior score, and feature reasons
- fails open to deterministic-only behavior when ML is unavailable or incompatible

## Package Entry Points

- importable module: `threatflix_ueba`
- FastAPI app: `threatflix_ueba.app:app`
- CLI server command: `threatflix-ueba-serve`

The service only scores sessions supplied from an existing deterministic investigation. It must not create
investigations independently.
