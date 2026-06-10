import unittest

from feature_extractor import UEBA_FEATURE_NAMES, derive_feature_rows
from generate_dataset import ATTACK_SCENARIOS, generate_dataset


class SyntheticDatasetTests(unittest.TestCase):
    def test_generation_is_deterministic(self) -> None:
        left = generate_dataset(seed=42)
        right = generate_dataset(seed=42)
        self.assertEqual(left, right)

    def test_training_events_are_normal_only(self) -> None:
        training_events, _, manifest = generate_dataset(seed=42)
        labels = {event["metadata"]["syntheticLabel"] for event in training_events}

        self.assertEqual(labels, {"normal"})
        self.assertEqual(manifest["projectId"], "synthetic-demo")

    def test_evaluation_events_cover_all_attack_scenarios(self) -> None:
        _, evaluation_events, manifest = generate_dataset(seed=42)
        scenarios = {
            event["metadata"]["syntheticScenario"]
            for event in evaluation_events
            if event["metadata"]["syntheticLabel"] == "attack"
        }

        self.assertEqual(scenarios, set(ATTACK_SCENARIOS))
        self.assertTrue(all(manifest["scenarioEventCounts"][name] > 0 for name in ATTACK_SCENARIOS))

    def test_event_shape_matches_backend_ingestion_contract(self) -> None:
        training_events, evaluation_events, _ = generate_dataset(seed=42)
        event = training_events[0]
        attack_event = next(
            row for row in evaluation_events if row["metadata"]["syntheticLabel"] == "attack"
        )

        for candidate in (event, attack_event):
            self.assertIn("id", candidate)
            self.assertIn("projectId", candidate)
            self.assertIn("event", candidate)
            self.assertIn("user", candidate)
            self.assertIn("ip", candidate)
            self.assertIn("service", candidate)
            self.assertIn("timestamp", candidate)
            self.assertIn("sessionId", candidate)
            self.assertIn("metadata", candidate)
            self.assertIn("tags", candidate)

    def test_feature_rows_use_the_21_feature_schema(self) -> None:
        training_events, evaluation_events, _ = generate_dataset(seed=42)
        rows = derive_feature_rows(training_events[:100] + evaluation_events[:100])

        self.assertGreater(len(rows), 0)
        self.assertEqual(list(rows[0]["features"].keys()), UEBA_FEATURE_NAMES)
        self.assertTrue(all(len(row["features"]) == 21 for row in rows))

    def test_attack_feature_rows_preserve_label_and_scenario(self) -> None:
        _, evaluation_events, _ = generate_dataset(seed=42)
        rows = derive_feature_rows(evaluation_events)
        attack_rows = [row for row in rows if row["label"] == "attack"]

        self.assertGreater(len(attack_rows), 0)
        self.assertTrue(all(row["scenario"] in ATTACK_SCENARIOS for row in attack_rows))


if __name__ == "__main__":
    unittest.main()
