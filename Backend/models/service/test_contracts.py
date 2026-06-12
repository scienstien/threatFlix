import unittest

from pydantic import ValidationError

from threatflix_ueba.contracts import UEBA_SCHEMA_VERSION, UebaScoreRequest, UebaScoreResponse


class UebaContractTests(unittest.TestCase):
    def test_accepts_versioned_score_request(self) -> None:
        request = UebaScoreRequest(
            schemaVersion=UEBA_SCHEMA_VERSION,
            projectId="project-1",
            sessionId="session-1",
            user="analyst@example.com",
            ip="203.0.113.10",
            service="auth",
            eventIds=["event-1"],
            features={"failedLogins": 10},
        )

        self.assertEqual(request.schemaVersion, "1")
        self.assertEqual(request.features["failedLogins"], 10)

    def test_rejects_out_of_range_scores(self) -> None:
        with self.assertRaises(ValidationError):
            UebaScoreResponse(
                schemaVersion=UEBA_SCHEMA_VERSION,
                modelVersion="bootstrap-1",
                behaviorScore=101,
                anomalyScore=1.1,
                isAnomaly=True,
                detectorScores={
                    "isolationForest": 0.8,
                    "ecod": 0.9,
                    "copod": 0.85,
                },
                topReasons=[],
            )


if __name__ == "__main__":
    unittest.main()
