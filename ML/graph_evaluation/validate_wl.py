"""Offline GraKeL validation for ThreatFlix's TypeScript WL similarity ranking."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "inputs" / "corpus.json"
DEFAULT_OUTPUT_DIR = ROOT / "outputs"

# GraKeL 0.1.10 imports this symbol from NumPy's pre-2.0 location.
if not hasattr(np, "ComplexWarning"):
    np.ComplexWarning = np.exceptions.ComplexWarning  # type: ignore[attr-defined]


def to_grakel_components(canonical_graph: dict[str, Any]) -> tuple[dict[int, list[int]], dict[int, str]]:
    """Preserve directed typed edges in an undirected labeled-kernel representation."""
    node_ids = {node["id"]: index for index, node in enumerate(canonical_graph["nodes"])}
    adjacency: dict[int, list[int]] = {index: [] for index in node_ids.values()}
    labels = {node_ids[node["id"]]: node["label"] for node in canonical_graph["nodes"]}
    next_id = len(node_ids)

    for edge in canonical_graph["edges"]:
        source = node_ids[edge["source"]]
        target = node_ids[edge["target"]]
        out_marker = next_id
        in_marker = next_id + 1
        next_id += 2
        labels[out_marker] = f"edge_out:{edge['type']}"
        labels[in_marker] = f"edge_in:{edge['type']}"
        adjacency[out_marker] = []
        adjacency[in_marker] = []
        connect(adjacency, source, out_marker)
        connect(adjacency, out_marker, in_marker)
        connect(adjacency, in_marker, target)

    return adjacency, labels


def connect(adjacency: dict[int, list[int]], left: int, right: int) -> None:
    adjacency[left].append(right)
    adjacency[right].append(left)


def run_validation(corpus: dict[str, Any]) -> dict[str, Any]:
    try:
        from grakel import Graph
        from grakel.kernels import VertexHistogram, WeisfeilerLehman
    except ModuleNotFoundError as error:
        raise SystemExit(
            "GraKeL is required for offline graph validation. Run `uv sync` in ML first."
        ) from error

    records = corpus["records"]
    if len(records) < 2:
        raise ValueError("At least two canonical graphs are required for validation.")

    graphs = []
    for record in records:
        adjacency, labels = to_grakel_components(record["canonicalGraph"])
        graphs.append(Graph(adjacency, node_labels=labels))

    kernel = WeisfeilerLehman(
        n_iter=2,
        base_graph_kernel=VertexHistogram,
        normalize=True,
    )
    kernel_matrix = np.asarray(kernel.fit_transform(graphs), dtype=float)
    ids = [record["investigationId"] for record in records]
    titles = {record["investigationId"]: record["title"] for record in records}
    ts_scores = typescript_score_map(corpus["typescriptRows"])
    rows: list[dict[str, Any]] = []
    pair_scores: list[dict[str, Any]] = []
    top_one_agreements = 0
    rank_correlations: list[float] = []

    for source_index, source_id in enumerate(ids):
        candidates = [candidate_id for candidate_id in ids if candidate_id != source_id]
        ts_ranked = sorted(
            candidates,
            key=lambda candidate_id: (-ts_scores.get((source_id, candidate_id), 0.0), candidate_id),
        )
        grakel_ranked = sorted(
            candidates,
            key=lambda candidate_id: (-float(kernel_matrix[source_index, ids.index(candidate_id)]), candidate_id),
        )
        if ts_ranked[0] == grakel_ranked[0]:
            top_one_agreements += 1
        rank_correlation = spearman_rank_correlation(ts_ranked, grakel_ranked)
        rank_correlations.append(rank_correlation)
        rows.append({
            "investigationId": source_id,
            "title": titles[source_id],
            "typescriptTopMatch": ts_ranked[0],
            "grakelTopMatch": grakel_ranked[0],
            "topOneAgreement": ts_ranked[0] == grakel_ranked[0],
            "spearmanRankCorrelation": round(rank_correlation, 4),
        })
        for candidate_id in candidates:
            pair_scores.append({
                "sourceInvestigationId": source_id,
                "candidateInvestigationId": candidate_id,
                "typescriptScore": ts_scores.get((source_id, candidate_id), 0.0),
                "grakelScore": round(float(kernel_matrix[source_index, ids.index(candidate_id)]), 4),
            })

    ts_values = np.asarray([pair["typescriptScore"] for pair in pair_scores], dtype=float)
    grakel_values = np.asarray([pair["grakelScore"] for pair in pair_scores], dtype=float)
    related = [pair for pair in pair_scores if pair["typescriptScore"] >= 0.3]
    unrelated = [pair for pair in pair_scores if pair["typescriptScore"] < 0.3]
    return {
        "generatedAt": corpus["generatedAt"],
        "projectId": corpus["projectId"],
        "graphCount": len(records),
        "representation": "directed typed edges encoded as edge_out/edge_in connector nodes",
        "grakelKernel": {
            "kernel": "WeisfeilerLehman",
            "baseKernel": "VertexHistogram",
            "iterations": 2,
            "normalized": True,
        },
        "metrics": {
            "topOneAgreement": round(top_one_agreements / len(records), 4),
            "meanSpearmanRankCorrelation": round(float(np.mean(rank_correlations)), 4),
            "pairScorePearsonCorrelation": round(correlation(ts_values, grakel_values), 4),
            "typescriptRelatedMean": rounded_mean([pair["typescriptScore"] for pair in related]),
            "typescriptUnrelatedMean": rounded_mean([pair["typescriptScore"] for pair in unrelated]),
            "grakelRelatedMean": rounded_mean([pair["grakelScore"] for pair in related]),
            "grakelUnrelatedMean": rounded_mean([pair["grakelScore"] for pair in unrelated]),
        },
        "rows": rows,
        "pairScores": pair_scores,
    }


def typescript_score_map(rows: list[dict[str, Any]]) -> dict[tuple[str, str], float]:
    return {
        (row["investigationId"], match["investigationId"]): float(match["similarity"])
        for row in rows
        for match in row["matches"]
    }


def spearman_rank_correlation(left: list[str], right: list[str]) -> float:
    if len(left) <= 1:
        return 1.0
    left_ranks = {value: rank for rank, value in enumerate(left)}
    right_ranks = {value: rank for rank, value in enumerate(right)}
    left_values = np.asarray([left_ranks[value] for value in left], dtype=float)
    right_values = np.asarray([right_ranks[value] for value in left], dtype=float)
    return correlation(left_values, right_values)


def correlation(left: np.ndarray, right: np.ndarray) -> float:
    if left.size < 2 or np.std(left) == 0 or np.std(right) == 0:
        return 0.0
    return float(np.corrcoef(left, right)[0, 1])


def rounded_mean(values: list[float]) -> float:
    return round(float(np.mean(values)), 4) if values else 0.0


def markdown(result: dict[str, Any]) -> str:
    metrics = result["metrics"]
    lines = [
        "# Offline GraKeL WL Validation",
        "",
        f"Project: {result['projectId']}",
        f"Graphs: {result['graphCount']}",
        "",
        "This is an offline ranking cross-check. GraKeL scores are not runtime scores or thresholds.",
        "",
        "| Metric | Value |",
        "| --- | ---: |",
        f"| Top-1 agreement | {metrics['topOneAgreement']:.4f} |",
        f"| Mean Spearman ranking correlation | {metrics['meanSpearmanRankCorrelation']:.4f} |",
        f"| Pair-score Pearson correlation | {metrics['pairScorePearsonCorrelation']:.4f} |",
        f"| GraKeL mean for TypeScript-related pairs | {metrics['grakelRelatedMean']:.4f} |",
        f"| GraKeL mean for TypeScript-unrelated pairs | {metrics['grakelUnrelatedMean']:.4f} |",
        "",
        "| Source | TypeScript top match | GraKeL top match | Agreement | Spearman |",
        "| --- | --- | --- | --- | ---: |",
    ]
    for row in result["rows"]:
        lines.append(
            f"| {row['title']} | `{row['typescriptTopMatch'][:12]}` | "
            f"`{row['grakelTopMatch'][:12]}` | {str(row['topOneAgreement']).lower()} | "
            f"{row['spearmanRankCorrelation']:.4f} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    arguments = parser.parse_args()
    corpus = json.loads(arguments.input.read_text(encoding="utf-8"))
    result = run_validation(corpus)
    arguments.output_dir.mkdir(parents=True, exist_ok=True)
    (arguments.output_dir / "grakel_wl_validation.json").write_text(
        json.dumps(result, indent=2), encoding="utf-8"
    )
    (arguments.output_dir / "grakel_wl_validation.md").write_text(
        markdown(result), encoding="utf-8"
    )
    print(json.dumps(result["metrics"], indent=2))


if __name__ == "__main__":
    main()
