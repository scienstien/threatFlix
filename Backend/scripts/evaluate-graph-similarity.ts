import { closeDb } from "../src/db/database.ts";
import { investigationRepo } from "../src/db/repositories/investigationRepository.ts";
import { getSimilarIncidents } from "../src/ai/graphSimilarity/service.ts";
import { mkdirSync } from "fs";
import { join } from "path";

const projectId = process.argv.slice(2).find((argument) => !argument.startsWith("--")) ??
  "demo-customer-acme-india";
const investigations = investigationRepo.getAll(projectId);
const rows = investigations.map((investigation) => ({
  investigationId: investigation.id,
  title: investigation.title,
  matches: getSimilarIncidents(investigation, 10, 0).matches.map((match) => ({
    investigationId: match.investigationId,
    title: match.title,
    similarity: match.similarity,
    scoreBreakdown: match.scoreBreakdown,
    relation: match.relation,
    mode: match.mode,
    sharedStages: match.sharedSignals.stages,
    differences: match.differentSignals.eventTypes,
  })),
}));
const result = {
  generatedAt: new Date().toISOString(),
  projectId,
  investigationCount: investigations.length,
  displayThreshold: 0.3,
  relationBands: { strong: 0.45, related: 0.3 },
  rows,
};
const json = JSON.stringify(result, null, 2);
console.log(json);
if (process.argv.includes("--write")) {
  const outputDir = join(process.cwd(), "outputs");
  mkdirSync(outputDir, { recursive: true });
  await Bun.write(join(outputDir, "graph_similarity_evaluation.json"), json);
  await Bun.write(join(outputDir, "graph_similarity_evaluation.md"), markdown(result));
}
closeDb();

function markdown(value: {
  generatedAt: string;
  projectId: string;
  investigationCount: number;
  displayThreshold: number;
  rows: Array<{ title: string; matches: Array<{ title?: string; similarity: number; relation: string }> }>;
}): string {
  const lines = [
    "# Graph Similarity Evaluation",
    "",
    `Generated: ${value.generatedAt}`,
    `Project: ${value.projectId}`,
    `Investigations: ${value.investigationCount}`,
    `Display threshold: ${value.displayThreshold}`,
    "",
    "| Source | Top match | Score | Relation |",
    "| --- | --- | ---: | --- |",
  ];
  for (const row of value.rows) {
    const top = row.matches[0];
    lines.push(`| ${row.title} | ${top?.title ?? "None"} | ${top?.similarity ?? 0} | ${top?.relation ?? "none"} |`);
  }
  return `${lines.join("\n")}\n`;
}
