import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from feature_extractor import UEBA_FEATURE_NAMES
from train import (
    DETECTOR_WEIGHTS,
    TrainingConfig,
    empirical_percentiles,
    ensemble_scores,
    evaluate_scores,
    feature_baselines,
    load_feature_dataset,
    train_and_export,
)


class EnsembleTrainingTests(unittest.TestCase):
    def test_detector_weights_sum_to_one(self) -> None:
        self.assertAlmostEqual(sum(DETECTOR_WEIGHTS.values()), 1.0)

    def test_empirical_percentiles_use_normal_score_reference(self) -> None:
        reference = np.array([1.0, 2.0, 3.0, 4.0])
        scores = np.array([0.0, 2.0, 5.0])

        result = empirical_percentiles(scores, reference)

        np.testing.assert_allclose(result, np.array([0.0, 0.5, 1.0]))

    def test_ensemble_score_uses_locked_weights(self) -> None:
        result = ensemble_scores(
            {
                "isolationForest": np.array([1.0]),
                "ecod": np.array([0.5]),
                "copod": np.array([0.0]),
            }
        )

        np.testing.assert_allclose(result, np.array([0.6]))

    def test_loader_uses_fixed_feature_order_and_rejects_attack_training_rows(self) -> None:
        features = {name: float(index) for index, name in enumerate(reversed(UEBA_FEATURE_NAMES))}
        row = {"label": "normal", "scenario": "normal", "features": features}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "features.jsonl"
            path.write_text(json.dumps(row) + "\n", encoding="utf-8")

            dataset = load_feature_dataset(path, require_normal_only=True)

            self.assertEqual(dataset.matrix.shape, (1, 21))
            self.assertEqual(dataset.matrix[0, 0], features[UEBA_FEATURE_NAMES[0]])

            row["label"] = "attack"
            path.write_text(json.dumps(row) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "attack data"):
                load_feature_dataset(path, require_normal_only=True)

    def test_feature_baselines_include_every_feature(self) -> None:
        matrix = np.vstack([np.zeros(21), np.ones(21), np.full(21, 2.0)])

        baselines = feature_baselines(matrix)

        self.assertEqual(list(baselines), UEBA_FEATURE_NAMES)
        self.assertEqual(baselines[UEBA_FEATURE_NAMES[0]]["median"], 1.0)

    def test_evaluation_reports_ranking_and_false_positive_metrics(self) -> None:
        result = evaluate_scores(
            labels=np.array([0, 0, 1, 1]),
            scenarios=["normal", "normal", "attack-a", "attack-b"],
            scores=np.array([0.1, 0.95, 0.99, 0.8]),
            threshold=0.9,
        )

        self.assertEqual(result["attackRowCount"], 2)
        self.assertEqual(result["falsePositivesAtThreshold"], 1)
        self.assertEqual(result["precisionAtK"], 0.5)
        self.assertEqual(result["recallAtK"], 0.5)

    def test_training_requires_explicit_confirmation_before_data_or_models_are_touched(self) -> None:
        with self.assertRaisesRegex(PermissionError, "Training was not started"):
            train_and_export(confirmed=False, config=TrainingConfig())


if __name__ == "__main__":
    unittest.main()
