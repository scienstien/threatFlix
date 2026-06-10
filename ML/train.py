from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import average_precision_score, roc_auc_score

from feature_extractor import UEBA_FEATURE_NAMES


SCHEMA_VERSION = "1"
DEFAULT_MODEL_VERSION = "ueba-ensemble-v1"
DEFAULT_THRESHOLD = 0.99
DETECTOR_WEIGHTS = {
    "isolationForest": 0.45,
    "ecod": 0.30,
    "copod": 0.25,
}

WORKSPACE_DIR = Path(__file__).resolve().parent
DATASET_DIR = WORKSPACE_DIR / "outputs" / "datasets"
ARTIFACT_DIR = WORKSPACE_DIR / "outputs" / "artifacts"
TRAINING_FEATURES_PATH = DATASET_DIR / "training_features.jsonl"
EVALUATION_FEATURES_PATH = DATASET_DIR / "evaluation_features.jsonl"
DATASET_MANIFEST_PATH = DATASET_DIR / "dataset_manifest.json"
BUNDLE_PATH = ARTIFACT_DIR / "ueba_bundle.joblib"
METADATA_PATH = ARTIFACT_DIR / "ueba_metadata.json"


@dataclass(frozen=True)
class FeatureDataset:
    rows: list[dict[str, Any]]
    matrix: np.ndarray
    labels: np.ndarray
    scenarios: list[str]


@dataclass(frozen=True)
class TrainingConfig:
    model_version: str = DEFAULT_MODEL_VERSION
    anomaly_threshold: float = DEFAULT_THRESHOLD
    random_state: int = 42
    isolation_forest_estimators: int = 200


def load_feature_dataset(path: Path, *, require_normal_only: bool) -> FeatureDataset:
    rows = list(read_jsonl(path))
    if not rows:
        raise ValueError(f"Feature dataset is empty: {path}")

    matrix_rows: list[list[float]] = []
    labels: list[int] = []
    scenarios: list[str] = []
    expected_features = set(UEBA_FEATURE_NAMES)

    for line_number, row in enumerate(rows, start=1):
        features = row.get("features")
        if not isinstance(features, dict):
            raise ValueError(f"{path}:{line_number} has no feature object")
        if set(features) != expected_features:
            missing = sorted(expected_features - set(features))
            extra = sorted(set(features) - expected_features)
            raise ValueError(
                f"{path}:{line_number} feature schema mismatch; missing={missing}, extra={extra}"
            )

        label = str(row.get("label", ""))
        if label not in {"normal", "attack"}:
            raise ValueError(f"{path}:{line_number} has unsupported label: {label!r}")
        if require_normal_only and label != "normal":
            raise ValueError(f"{path}:{line_number} contains attack data in the training dataset")

        matrix_rows.append([float(features[name]) for name in UEBA_FEATURE_NAMES])
        labels.append(1 if label == "attack" else 0)
        scenarios.append(str(row.get("scenario", "unknown")))

    matrix = np.asarray(matrix_rows, dtype=float)
    if not np.isfinite(matrix).all():
        raise ValueError(f"Feature dataset contains non-finite values: {path}")

    return FeatureDataset(
        rows=rows,
        matrix=matrix,
        labels=np.asarray(labels, dtype=int),
        scenarios=scenarios,
    )


def read_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Required feature dataset does not exist: {path}")
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f"{path}:{line_number} must contain a JSON object")
            yield value


def fit_detectors(matrix: np.ndarray, config: TrainingConfig) -> dict[str, Any]:
    from pyod.models.copod import COPOD
    from pyod.models.ecod import ECOD

    detectors: dict[str, Any] = {
        "isolationForest": IsolationForest(
            n_estimators=config.isolation_forest_estimators,
            contamination="auto",
            random_state=config.random_state,
            n_jobs=-1,
        ),
        "ecod": ECOD(),
        "copod": COPOD(),
    }
    for detector in detectors.values():
        detector.fit(matrix)
    return detectors


def raw_detector_scores(detectors: dict[str, Any], matrix: np.ndarray) -> dict[str, np.ndarray]:
    return {
        "isolationForest": -np.asarray(detectors["isolationForest"].score_samples(matrix), dtype=float),
        "ecod": np.asarray(detectors["ecod"].decision_function(matrix), dtype=float),
        "copod": np.asarray(detectors["copod"].decision_function(matrix), dtype=float),
    }


def build_score_references(raw_scores: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    return {
        name: np.sort(np.asarray(scores, dtype=float))
        for name, scores in raw_scores.items()
    }


def empirical_percentiles(raw_scores: np.ndarray, reference: np.ndarray) -> np.ndarray:
    reference_array = np.asarray(reference, dtype=float)
    if reference_array.ndim != 1 or reference_array.size == 0:
        raise ValueError("Percentile reference must be a non-empty one-dimensional array")
    if not np.isfinite(reference_array).all():
        raise ValueError("Percentile reference contains non-finite values")

    scores = np.asarray(raw_scores, dtype=float)
    if not np.isfinite(scores).all():
        raise ValueError("Raw detector scores contain non-finite values")
    return np.searchsorted(reference_array, scores, side="right") / reference_array.size


def normalize_detector_scores(
    raw_scores: dict[str, np.ndarray],
    references: dict[str, np.ndarray],
) -> dict[str, np.ndarray]:
    return {
        name: empirical_percentiles(raw_scores[name], references[name])
        for name in DETECTOR_WEIGHTS
    }


def ensemble_scores(normalized_scores: dict[str, np.ndarray]) -> np.ndarray:
    return sum(
        DETECTOR_WEIGHTS[name] * np.asarray(normalized_scores[name], dtype=float)
        for name in DETECTOR_WEIGHTS
    )


def feature_baselines(matrix: np.ndarray) -> dict[str, dict[str, float]]:
    medians = np.median(matrix, axis=0)
    absolute_deviations = np.abs(matrix - medians)
    mads = np.median(absolute_deviations, axis=0)
    percentiles_25 = np.percentile(matrix, 25, axis=0)
    percentiles_75 = np.percentile(matrix, 75, axis=0)
    return {
        name: {
            "median": float(medians[index]),
            "mad": float(mads[index]),
            "p25": float(percentiles_25[index]),
            "p75": float(percentiles_75[index]),
        }
        for index, name in enumerate(UEBA_FEATURE_NAMES)
    }


def evaluate_scores(
    labels: np.ndarray,
    scenarios: list[str],
    scores: np.ndarray,
    threshold: float,
) -> dict[str, Any]:
    labels_array = np.asarray(labels, dtype=int)
    scores_array = np.asarray(scores, dtype=float)
    if labels_array.shape != scores_array.shape:
        raise ValueError("Evaluation labels and scores must have the same shape")

    attack_count = int(labels_array.sum())
    normal_count = int(labels_array.size - attack_count)
    predictions = scores_array >= threshold
    true_positives = int(np.logical_and(predictions, labels_array == 1).sum())
    false_positives = int(np.logical_and(predictions, labels_array == 0).sum())
    top_k = attack_count
    if top_k:
        top_indices = np.argsort(scores_array)[::-1][:top_k]
        precision_at_k = float(labels_array[top_indices].mean())
        recall_at_k = float(labels_array[top_indices].sum() / attack_count)
    else:
        precision_at_k = 0.0
        recall_at_k = 0.0

    scenario_summary: dict[str, dict[str, float | int]] = {}
    for scenario in sorted(set(scenarios)):
        indexes = np.asarray([value == scenario for value in scenarios], dtype=bool)
        scenario_labels = labels_array[indexes]
        scenario_scores = scores_array[indexes]
        scenario_summary[scenario] = {
            "rowCount": int(indexes.sum()),
            "attackRowCount": int(scenario_labels.sum()),
            "meanAnomalyScore": float(scenario_scores.mean()) if scenario_scores.size else 0.0,
            "maxAnomalyScore": float(scenario_scores.max()) if scenario_scores.size else 0.0,
        }

    has_both_classes = attack_count > 0 and normal_count > 0
    return {
        "rowCount": int(labels_array.size),
        "attackRowCount": attack_count,
        "normalRowCount": normal_count,
        "threshold": threshold,
        "alertsAtThreshold": int(predictions.sum()),
        "truePositivesAtThreshold": true_positives,
        "falsePositivesAtThreshold": false_positives,
        "falsePositivesPer1000NormalSessions": (
            float(false_positives / normal_count * 1000) if normal_count else 0.0
        ),
        "precisionAtK": precision_at_k,
        "recallAtK": recall_at_k,
        "rocAuc": float(roc_auc_score(labels_array, scores_array)) if has_both_classes else None,
        "prAuc": (
            float(average_precision_score(labels_array, scores_array)) if has_both_classes else None
        ),
        "scenarios": scenario_summary,
    }


def train_and_export(*, confirmed: bool, config: TrainingConfig) -> dict[str, Any]:
    if not confirmed:
        raise PermissionError(
            "Training was not started. Explicit confirmation is required before fitting models."
        )

    training = load_feature_dataset(TRAINING_FEATURES_PATH, require_normal_only=True)
    evaluation = load_feature_dataset(EVALUATION_FEATURES_PATH, require_normal_only=False)
    detectors = fit_detectors(training.matrix, config)

    training_raw_scores = raw_detector_scores(detectors, training.matrix)
    score_references = build_score_references(training_raw_scores)
    evaluation_raw_scores = raw_detector_scores(detectors, evaluation.matrix)
    normalized_evaluation_scores = normalize_detector_scores(
        evaluation_raw_scores,
        score_references,
    )
    evaluation_ensemble_scores = ensemble_scores(normalized_evaluation_scores)
    evaluation_summary = evaluate_scores(
        evaluation.labels,
        evaluation.scenarios,
        evaluation_ensemble_scores,
        config.anomaly_threshold,
    )
    baselines = feature_baselines(training.matrix)
    created_at = datetime.now(UTC).isoformat()

    bundle = {
        "bundleVersion": "1",
        "schemaVersion": SCHEMA_VERSION,
        "modelVersion": config.model_version,
        "createdAt": created_at,
        "featureNames": UEBA_FEATURE_NAMES,
        "detectors": detectors,
        "detectorWeights": DETECTOR_WEIGHTS,
        "scoreReferences": score_references,
        "anomalyThreshold": config.anomaly_threshold,
        "featureBaselines": baselines,
    }
    metadata = {
        "bundleVersion": bundle["bundleVersion"],
        "schemaVersion": SCHEMA_VERSION,
        "modelVersion": config.model_version,
        "createdAt": created_at,
        "featureNames": UEBA_FEATURE_NAMES,
        "detectors": {
            "isolationForest": {
                "weight": DETECTOR_WEIGHTS["isolationForest"],
                "nEstimators": config.isolation_forest_estimators,
                "randomState": config.random_state,
            },
            "ecod": {"weight": DETECTOR_WEIGHTS["ecod"]},
            "copod": {"weight": DETECTOR_WEIGHTS["copod"]},
        },
        "anomalyThreshold": config.anomaly_threshold,
        "trainingSummary": {
            "rowCount": int(training.matrix.shape[0]),
            "featureCount": int(training.matrix.shape[1]),
            "normalOnly": True,
            "datasetManifest": load_optional_json(DATASET_MANIFEST_PATH),
        },
        "evaluationSummary": evaluation_summary,
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, BUNDLE_PATH)
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def load_optional_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train and export the ThreatFlix UEBA ensemble")
    parser.add_argument(
        "--confirm-training",
        action="store_true",
        help="Required acknowledgement before any detector is fitted or artifact is written",
    )
    parser.add_argument("--model-version", default=DEFAULT_MODEL_VERSION)
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.confirm_training:
        raise SystemExit(
            "Training not started. Review the architecture and rerun with --confirm-training."
        )
    if not 0.0 < args.threshold <= 1.0:
        raise SystemExit("--threshold must be greater than 0 and at most 1")

    metadata = train_and_export(
        confirmed=True,
        config=TrainingConfig(
            model_version=args.model_version,
            anomaly_threshold=args.threshold,
        ),
    )
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
