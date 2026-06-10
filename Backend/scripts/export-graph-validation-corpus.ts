import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { closeDb } from "../src/db/database.ts";
import { investigationRepo } from "../src/db/repositories/investigationRepository.ts";
import { graphSimilarityRepo } from "../src/db/repositories/graphSimilarityRepository.ts";
import { getSimilarIncidents } from "../src/ai/graphSimilarity/service.ts";
import {
  GRAPH_SIMILARITY_ALGORITHM_VERSION,
  GRAPH_SIMILARITY_SCHEMA_VERSION,
} from "../src/types/graphSimilarity.ts";

const arguments_ = process.argv.slice(2);
const projectId = arguments_.find((argument) => !argument.startsWith("--")) ??
  "demo-customer-acme-india";
const outputArgument = arguments_.find((argument) => argument.startsWith("--output="));
const outputPath = outputArgument
  ? resolve(outputArgument.slice("--output=".length))
  : resolve(process.cwd(), "..", "ML", "graph_evaluation", "inputs", "corpus.json");

const investigations = investigationRepo.getAll(projectId);
const records = investigations.flatMap((investigation) => {
  const graphRecord = graphSimilarityRepo.getByInvestigation(investigation.id, projectId);
  return graphRecord
    ? [{
        investigationId: investigation.id,
        title: investigation.title,
        createdAt: investigation.createdAt,
        canonicalGraph: graphRecord.canonicalGraph,
      }]
    : [];
});
const typescriptRows = investigations.map((investigation) => ({
  investigationId: investigation.id,
  matches: getSimilarIncidents(investigation, 10_000, 0).matches.map((match) => ({
    investigationId: match.investigationId,
    similarity: match.similarity,
  })),
}));
const corpus = {
  generatedAt: new Date().toISOString(),
  projectId,
  schemaVersion: GRAPH_SIMILARITY_SCHEMA_VERSION,
  algorithmVersion: GRAPH_SIMILARITY_ALGORITHM_VERSION,
  records,
  typescriptRows,
};

mkdirSync(dirname(outputPath), { recursive: true });
await Bun.write(outputPath, JSON.stringify(corpus, null, 2));
console.log(JSON.stringify({
  projectId,
  outputPath,
  investigations: investigations.length,
  canonicalGraphs: records.length,
}, null, 2));
closeDb();
