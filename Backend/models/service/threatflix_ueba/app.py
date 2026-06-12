from __future__ import annotations

from importlib.resources import files
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException

from .contracts import (
    UEBA_SCHEMA_VERSION,
    UebaFeatureReason,
    UebaScoreRequest,
    UebaScoreResponse,
)


def resolve_bundle_path() -> Path:
    packaged = Path(str(files("threatflix_ueba").joinpath("artifacts/ueba_bundle.joblib")))
    if packaged.exists():
        return packaged
    return Path(__file__).resolve().parent.parent / "artifacts" / "ueba_bundle.joblib"


BUNDLE_PATH = resolve_bundle_path()

app = FastAPI(title="ThreatFlix UEBA Scoring Service")
bundle = joblib.load(BUNDLE_PATH) if BUNDLE_PATH.exists() else None


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True, "modelLoaded": bundle is not None}


@app.post("/score", response_model=UebaScoreResponse)
def score(request: UebaScoreRequest) -> UebaScoreResponse:
    if bundle is None:
        raise HTTPException(status_code=503, detail="UEBA model artifact is not loaded")

    runtime_bundle = validate_bundle(bundle)
    if request.schemaVersion != runtime_bundle["schemaVersion"]:
        raise HTTPException(status_code=503, detail="UEBA schema version is incompatible with the loaded bundle")

    vector = build_feature_vector(request, runtime_bundle["featureNames"])
    raw_scores = raw_detector_scores(runtime_bundle["detectors"], vector)
    detector_scores = normalize_detector_scores(raw_scores, runtime_bundle["scoreReferences"])
    anomaly_score = weighted_anomaly_score(detector_scores, runtime_bundle["detectorWeights"])
    behavior_score = round(anomaly_score * 100.0, 2)
    is_anomaly = anomaly_score >= runtime_bundle["anomalyThreshold"]
    top_reasons = explain_top_reasons(
        request,
        runtime_bundle["featureNames"],
        runtime_bundle["featureBaselines"],
    )

    return UebaScoreResponse(
        schemaVersion=UEBA_SCHEMA_VERSION,
        modelVersion=str(runtime_bundle["modelVersion"]),
        behaviorScore=behavior_score,
        anomalyScore=anomaly_score,
        isAnomaly=is_anomaly,
        detectorScores=detector_scores,
        topReasons=top_reasons,
    )


def validate_bundle(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise HTTPException(status_code=503, detail="UEBA bundle is invalid")

    required_keys = [
        "schemaVersion",
        "modelVersion",
        "featureNames",
        "detectors",
        "detectorWeights",
        "scoreReferences",
        "anomalyThreshold",
        "featureBaselines",
    ]
    missing = [key for key in required_keys if key not in value]
    if missing:
        raise HTTPException(status_code=503, detail=f"UEBA bundle is missing keys: {', '.join(missing)}")
    if value["schemaVersion"] != UEBA_SCHEMA_VERSION:
        raise HTTPException(status_code=503, detail="UEBA bundle schema version is incompatible")
    return value


def build_feature_vector(request: UebaScoreRequest, feature_names: list[str]) -> np.ndarray:
    try:
        row = [float(request.features[name]) for name in feature_names]
    except KeyError as error:
        raise HTTPException(status_code=422, detail=f"Missing UEBA feature: {error.args[0]}") from error
    return np.array([row], dtype=float)


def raw_detector_scores(detectors: dict[str, Any], vector: np.ndarray) -> dict[str, float]:
    try:
        return {
            "isolationForest": float(-detectors["isolationForest"].score_samples(vector)[0]),
            "ecod": float(detectors["ecod"].decision_function(vector)[0]),
            "copod": float(detectors["copod"].decision_function(vector)[0]),
        }
    except KeyError as error:
        raise HTTPException(status_code=503, detail=f"UEBA detector is missing: {error.args[0]}") from error
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"UEBA detector scoring failed: {error}") from error


def normalize_detector_scores(
    raw_scores: dict[str, float],
    references: dict[str, Any],
) -> dict[str, float]:
    normalized: dict[str, float] = {}
    for name, raw_score in raw_scores.items():
        if name not in references:
            raise HTTPException(status_code=503, detail=f"UEBA score reference is missing: {name}")
        normalized[name] = empirical_percentile(raw_score, references[name])
    return normalized


def empirical_percentile(raw_score: float, reference: Any) -> float:
    reference_array = np.asarray(reference, dtype=float)
    if reference_array.ndim != 1 or reference_array.size == 0:
        raise HTTPException(status_code=503, detail="UEBA score reference is invalid")
    percentile = np.searchsorted(reference_array, raw_score, side="right") / reference_array.size
    return float(max(0.0, min(1.0, percentile)))


def weighted_anomaly_score(detector_scores: dict[str, float], weights: dict[str, Any]) -> float:
    try:
        score = sum(float(weights[name]) * detector_scores[name] for name in detector_scores)
    except KeyError as error:
        raise HTTPException(status_code=503, detail=f"UEBA detector weight is missing: {error.args[0]}") from error
    return float(max(0.0, min(1.0, score)))


def explain_top_reasons(
    request: UebaScoreRequest,
    feature_names: list[str],
    baselines: dict[str, Any],
    limit: int = 3,
) -> list[UebaFeatureReason]:
    reasons: list[dict[str, float | str]] = []
    for name in feature_names:
        baseline = baselines.get(name)
        if not isinstance(baseline, dict):
            continue
        value = float(request.features[name])
        median = float(baseline.get("median", 0.0))
        mad = float(baseline.get("mad", 0.0))
        spread = mad if mad > 0 else max(abs(median), 1.0)
        deviation = abs(value - median)
        contribution = deviation / spread
        reasons.append(
            {
                "feature": name,
                "value": value,
                "baseline": median,
                "direction": "high" if value >= median else "low",
                "contribution": contribution,
            }
        )

    if not reasons:
        return []

    max_contribution = max(float(reason["contribution"]) for reason in reasons)
    if max_contribution <= 0:
        return [
            UebaFeatureReason(
                feature=str(reason["feature"]),
                value=float(reason["value"]),
                baseline=float(reason["baseline"]),
                direction=str(reason["direction"]),
                contribution=0.0,
            )
            for reason in reasons[:limit]
        ]

    ranked = sorted(reasons, key=lambda reason: float(reason["contribution"]), reverse=True)[:limit]
    return [
        UebaFeatureReason(
            feature=str(reason["feature"]),
            value=float(reason["value"]),
            baseline=float(reason["baseline"]),
            direction=str(reason["direction"]),
            contribution=min(1.0, float(reason["contribution"]) / max_contribution),
        )
        for reason in ranked
    ]
