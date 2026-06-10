import unittest

from graph_evaluation.validate_wl import spearman_rank_correlation, to_grakel_components


class GraphValidationTests(unittest.TestCase):
    def test_directed_typed_edge_becomes_labeled_connector_path(self) -> None:
        adjacency, labels = to_grakel_components({
            "nodes": [
                {"id": "n1", "label": "event:failed_login"},
                {"id": "n2", "label": "rule:brute_force_10_failures_5m"},
            ],
            "edges": [{"source": "n1", "target": "n2", "type": "supports"}],
        })

        self.assertIn("edge_out:supports", labels.values())
        self.assertIn("edge_in:supports", labels.values())
        self.assertEqual(sum(len(neighbors) for neighbors in adjacency.values()), 6)

    def test_spearman_ranking_correlation_detects_order(self) -> None:
        self.assertEqual(spearman_rank_correlation(["a", "b", "c"], ["a", "b", "c"]), 1.0)
        self.assertEqual(spearman_rank_correlation(["a", "b", "c"], ["c", "b", "a"]), -1.0)


if __name__ == "__main__":
    unittest.main()
