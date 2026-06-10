import unittest

import numpy as np
from fastapi import HTTPException

import app
from contracts import UEBA_SCHEMA_VERSION, UebaScoreRequest


class FakeIsolationForest:
    def score_samples(self, vector: np.ndarray) -> np.ndarray:
        return np.array([-0.6], dtype=float)


class FakeDetector:
    def __init__(self, score: float) -> None:
        self.score = score

    def decision_function(self, vector: np.ndarray) -> np.ndarray:
        return np.array([self.score], dtype=float)


class AppScoringTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_bundle = app.bundle

    def tearDown(self) -> None:
        app.bundle = self.original_bundle

    def test_returns_full_ueba_response(self) -> None:
        app.bundle = fake_bundle()

        response = app.score(request())

        self.assertEqual(response.schemaVersion, UEBA_SCHEMA_VERSION)
        self.assertEqual(response.modelVersion, "ueba-ensemble-v1")
        self.assertAlmostEqual(response.detectorScores.isolationForest, 1.0)
        self.assertAlmostEqual(response.detectorScores.ecod, 1.0)
        self.assertAlmostEqual(response.detectorScores.copod, 0.75)
        self.assertAlmostEqual(response.anomalyScore, 0.9375)
        self.assertAlmostEqual(response.behaviorScore, 93.75)
        self.assertFalse(response.isAnomaly)
        self.assertEqual(response.topReasons[0].feature, "eventCount")
        self.assertIn("failedLogins", [reason.feature for reason in response.topReasons])

    def test_raises_503_when_bundle_is_missing(self) -> None:
        app.bundle = None

        with self.assertRaises(HTTPException) as context:
            app.score(request())

        self.assertEqual(context.exception.status_code, 503)

    def test_raises_422_when_a_feature_is_missing(self) -> None:
        app.bundle = fake_bundle()
        bad_request = request()
        del bad_request.features["failedLogins"]

        with self.assertRaises(HTTPException) as context:
            app.score(bad_request)

        self.assertEqual(context.exception.status_code, 422)

    def test_normalizes_top_reason_contributions(self) -> None:
        app.bundle = fake_bundle()
        response = app.score(request())

        self.assertGreaterEqual(len(response.topReasons), 2)
        self.assertEqual(response.topReasons[0].contribution, 1.0)
        self.assertLessEqual(response.topReasons[1].contribution, 1.0)


def fake_bundle() -> dict:
    return {
        "schemaVersion": UEBA_SCHEMA_VERSION,
        "modelVersion": "ueba-ensemble-v1",
        "featureNames": [
            "eventCount",
            "failedLogins",
            "successfulLogins",
        ],
        "detectors": {
            "isolationForest": FakeIsolationForest(),
            "ecod": FakeDetector(0.3),
            "copod": FakeDetector(0.2),
        },
        "detectorWeights": {
            "isolationForest": 0.45,
            "ecod": 0.30,
            "copod": 0.25,
        },
        "scoreReferences": {
            "isolationForest": np.array([0.1, 0.2, 0.3, 0.4, 0.5]),
            "ecod": np.array([0.0, 0.1, 0.2, 0.3]),
            "copod": np.array([0.0, 0.1, 0.2, 0.4]),
        },
        "anomalyThreshold": 0.99,
        "featureBaselines": {
            "eventCount": {"median": 1.0, "mad": 1.0},
            "failedLogins": {"median": 0.0, "mad": 1.0},
            "successfulLogins": {"median": 1.0, "mad": 1.0},
        },
    }


def request() -> UebaScoreRequest:
    return UebaScoreRequest(
        schemaVersion=UEBA_SCHEMA_VERSION,
        projectId="project-1",
        sessionId="session-1",
        user="alice@example.com",
        ip="203.0.113.10",
        service="auth",
        eventIds=["event-1"],
        features={
            "eventCount": 12.0,
            "failedLogins": 10.0,
            "successfulLogins": 1.0,
        },
    )


if __name__ == "__main__":
    unittest.main()
