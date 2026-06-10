from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.metrics import average_precision_score, roc_auc_score

from train import (
    BUNDLE_PATH,
    EVALUATION_FEATURES_PATH,
    METADATA_PATH,
    TRAINING_FEATURES_PATH,
    empirical_percentiles,
    ensemble_scores,
    load_feature_dataset,
    raw_detector_scores,
)


REVIEW_JSON_PATH = BUNDLE_PATH.with_name("ueba_statistical_review.json")
REVIEW_MARKDOWN_PATH = BUNDLE_PATH.with_name("ueba_statistical_review.md")
RUNS_DIR = BUNDLE_PATH.with_name("runs")
THRESHOLDS = (0.95, 0.975, 0.99, 0.995, 0.999, 0.9995, 0.99975)
QUANTILES = (0.0, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.995, 0.999, 1.0)


def describe(values: np.ndarray) -> dict[str, float]:
    array = np.asarray(values, dtype=float)
    return {
        "count": int(array.size),
        "mean": float(array.mean()),
        "std": float(array.std()),
        **{
            f"p{quantile * 100:g}": float(np.quantile(array, quantile))
            for quantile in QUANTILES
        },
    }


def ranking_metrics(labels: np.ndarray, scores: np.ndarray) -> dict[str, float]:
    return {
        "rocAuc": float(roc_auc_score(labels, scores)),
        "prAuc": float(average_precision_score(labels, scores)),
    }


def threshold_metrics(labels: np.ndarray, scores: np.ndarray, threshold: float) -> dict[str, float | int]:
    predictions = scores >= threshold
    true_positives = int(np.logical_and(predictions, labels == 1).sum())
    false_positives = int(np.logical_and(predictions, labels == 0).sum())
    false_negatives = int(np.logical_and(~predictions, labels == 1).sum())
    normal_count = int((labels == 0).sum())
    return {
        "threshold": threshold,
        "alerts": int(predictions.sum()),
        "truePositives": true_positives,
        "falsePositives": false_positives,
        "falseNegatives": false_negatives,
        "precision": float(true_positives / max(1, true_positives + false_positives)),
        "recall": float(true_positives / max(1, true_positives + false_negatives)),
        "falsePositivesPer1000NormalSessions": float(false_positives / max(1, normal_count) * 1000),
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_review() -> dict[str, Any]:
    bundle = joblib.load(BUNDLE_PATH)
    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    training = load_feature_dataset(TRAINING_FEATURES_PATH, require_normal_only=True)
    evaluation = load_feature_dataset(EVALUATION_FEATURES_PATH, require_normal_only=False)

    raw_scores = raw_detector_scores(bundle["detectors"], evaluation.matrix)
    normalized_scores = {
        name: empirical_percentiles(raw_scores[name], bundle["scoreReferences"][name])
        for name in bundle["detectorWeights"]
    }
    combined_scores = ensemble_scores(normalized_scores)
    normal_mask = evaluation.labels == 0
    attack_mask = evaluation.labels == 1

    detector_reviews = {}
    for name, scores in normalized_scores.items():
        detector_reviews[name] = {
            "weight": bundle["detectorWeights"][name],
            "ranking": ranking_metrics(evaluation.labels, scores),
            "normalScoreDistribution": describe(scores[normal_mask]),
            "attackScoreDistribution": describe(scores[attack_mask]),
        }

    variances = np.var(training.matrix, axis=0)
    feature_variance = [
        {
            "feature": feature,
            "variance": float(variances[index]),
            "uniqueValueCount": int(np.unique(training.matrix[:, index]).size),
            "isConstant": bool(variances[index] == 0.0),
        }
        for index, feature in enumerate(bundle["featureNames"])
    ]

    top_indices = np.argsort(combined_scores)[::-1][:25]
    top_sessions = [
        {
            "rank": rank,
            "sessionId": evaluation.rows[index]["sessionId"],
            "label": evaluation.rows[index]["label"],
            "scenario": evaluation.rows[index]["scenario"],
            "anomalyScore": float(combined_scores[index]),
            "detectorScores": {
                name: float(scores[index])
                for name, scores in normalized_scores.items()
            },
        }
        for rank, index in enumerate(top_indices, start=1)
    ]

    return {
        "modelVersion": bundle["modelVersion"],
        "schemaVersion": bundle["schemaVersion"],
        "createdAt": bundle["createdAt"],
        "artifactIntegrity": {
            "bundlePath": str(BUNDLE_PATH.relative_to(BUNDLE_PATH.parents[2])),
            "bundleBytes": BUNDLE_PATH.stat().st_size,
            "bundleSha256": sha256(BUNDLE_PATH),
            "metadataPath": str(METADATA_PATH.relative_to(METADATA_PATH.parents[2])),
            "metadataBytes": METADATA_PATH.stat().st_size,
            "metadataSha256": sha256(METADATA_PATH),
        },
        "dataset": {
            "trainingRows": int(training.matrix.shape[0]),
            "evaluationRows": int(evaluation.matrix.shape[0]),
            "evaluationNormalRows": int(normal_mask.sum()),
            "evaluationAttackRows": int(attack_mask.sum()),
        },
        "lockedConfiguration": {
            "featureNames": bundle["featureNames"],
            "detectorWeights": bundle["detectorWeights"],
            "deployedThreshold": bundle["anomalyThreshold"],
        },
        "ensemble": {
            "ranking": ranking_metrics(evaluation.labels, combined_scores),
            "normalScoreDistribution": describe(combined_scores[normal_mask]),
            "attackScoreDistribution": describe(combined_scores[attack_mask]),
            "thresholdComparison": [
                threshold_metrics(evaluation.labels, combined_scores, threshold)
                for threshold in THRESHOLDS
            ],
        },
        "detectors": detector_reviews,
        "featureVariance": feature_variance,
        "constantFeatures": [
            row["feature"] for row in feature_variance if row["isConstant"]
        ],
        "topRankedSessions": top_sessions,
        "trainingMetadata": metadata,
        "limitations": [
            "Evaluation contains only five attack sessions, one per synthetic scenario.",
            "Perfect ranking metrics on this synthetic dataset do not establish production performance.",
            "Constant or nearly constant features can reduce ECOD/COPOD statistical reliability.",
            "The deployed threshold should be chosen using acceptable analyst alert volume, not AUC alone.",
        ],
    }


def render_markdown(review: dict[str, Any]) -> str:
    ensemble = review["ensemble"]
    lines = [
        "# UEBA Ensemble Statistical Review",
        "",
        f"- Model version: `{review['modelVersion']}`",
        f"- Training rows: `{review['dataset']['trainingRows']}`",
        f"- Evaluation rows: `{review['dataset']['evaluationRows']}`",
        f"- Evaluation attacks: `{review['dataset']['evaluationAttackRows']}`",
        f"- ROC-AUC: `{ensemble['ranking']['rocAuc']:.6f}`",
        f"- PR-AUC: `{ensemble['ranking']['prAuc']:.6f}`",
        "",
        "## Threshold Comparison",
        "",
        "| Threshold | Alerts | True positives | False positives | Precision | Recall | FP / 1000 normal |",
        "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in ensemble["thresholdComparison"]:
        lines.append(
            f"| {row['threshold']:.5f} | {row['alerts']} | {row['truePositives']} | "
            f"{row['falsePositives']} | {row['precision']:.4f} | {row['recall']:.4f} | "
            f"{row['falsePositivesPer1000NormalSessions']:.4f} |"
        )

    lines.extend(
        [
            "",
            "## Detector Ranking",
            "",
            "| Detector | Weight | ROC-AUC | PR-AUC |",
            "| --- | ---: | ---: | ---: |",
        ]
    )
    for name, detector in review["detectors"].items():
        lines.append(
            f"| {name} | {detector['weight']:.2f} | "
            f"{detector['ranking']['rocAuc']:.6f} | {detector['ranking']['prAuc']:.6f} |"
        )

    lines.extend(
        [
            "",
            "## Constant Features",
            "",
            ", ".join(f"`{name}`" for name in review["constantFeatures"]) or "None",
            "",
            "## Top Ranked Sessions",
            "",
            "| Rank | Session | Label | Scenario | Score |",
            "| ---: | --- | --- | --- | ---: |",
        ]
    )
    for row in review["topRankedSessions"]:
        lines.append(
            f"| {row['rank']} | `{row['sessionId']}` | {row['label']} | "
            f"{row['scenario']} | {row['anomalyScore']:.6f} |"
        )

    lines.extend(["", "## Limitations", ""])
    lines.extend(f"- {limitation}" for limitation in review["limitations"])
    return "\n".join(lines) + "\n"


def archive_run(review: dict[str, Any]) -> Path:
    timestamp = str(review["createdAt"]).replace("-", "").replace(":", "")
    timestamp = timestamp.split(".", 1)[0].replace("+0000", "Z")
    run_dir = RUNS_DIR / f"{review['modelVersion']}_{timestamp}"
    run_dir.mkdir(parents=True, exist_ok=True)
    for source in (BUNDLE_PATH, METADATA_PATH, REVIEW_JSON_PATH, REVIEW_MARKDOWN_PATH):
        shutil.copy2(source, run_dir / source.name)
    return run_dir


def main() -> None:
    review = build_review()
    REVIEW_JSON_PATH.write_text(json.dumps(review, indent=2), encoding="utf-8")
    REVIEW_MARKDOWN_PATH.write_text(render_markdown(review), encoding="utf-8")
    run_dir = archive_run(review)
    print(f"Wrote {REVIEW_JSON_PATH}")
    print(f"Wrote {REVIEW_MARKDOWN_PATH}")
    print(f"Archived run in {run_dir}")


if __name__ == "__main__":
    main()
