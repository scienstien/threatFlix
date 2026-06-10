import { config } from "../config.ts";
import { eventRepo } from "../db/repositories/eventRepository.ts";
import { investigationRepo } from "../db/repositories/investigationRepository.ts";
import { llmRepo } from "../db/repositories/llmRepository.ts";
import { buildLlmIncidentContext } from "./llmContext.ts";
import { OllamaGemmaProvider } from "./ollamaProvider.ts";
import { getSimilarIncidents } from "./graphSimilarity/service.ts";
import type { LlmSimilarIncidentContext } from "../types/llm.ts";

let running = false;
const provider = new OllamaGemmaProvider();

export function enqueueInitialReport(investigationId: string, projectId: string) {
  const record = llmRepo.enqueue(investigationId, projectId, "initial", config.ollamaModel);
  void runReportWorker();
  return record;
}

export function enqueueManualReport(investigationId: string, projectId: string) {
  const record = llmRepo.enqueue(investigationId, projectId, "manual", config.ollamaModel);
  void runReportWorker();
  return record;
}

export function startReportWorker(): void {
  llmRepo.recoverStale();
  void runReportWorker();
}

export async function runReportWorker(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const job = llmRepo.claimNext();
      if (!job) break;
      try {
        const investigation = investigationRepo.getById(job.investigationId, job.projectId);
        if (!investigation) throw new Error("Investigation no longer exists");
        const events = eventRepo.getByIds(job.projectId, investigation.relatedEventIds);
        const similarIncidents = loadSimilarIncidentContext(investigation);
        const context = buildLlmIncidentContext(
          investigation,
          events,
          job.contextVersion,
          similarIncidents
        );
        llmRepo.setContext(job.id, context);
        const report = await provider.generateReport(context);
        llmRepo.complete(job.id, context, report);
      } catch (error) {
        llmRepo.fail(job.id, (error as Error).message, job.attemptCount < 3);
      }
    }
  } finally {
    running = false;
  }
}

function loadSimilarIncidentContext(
  investigation: NonNullable<ReturnType<typeof investigationRepo.getById>>
): LlmSimilarIncidentContext[] {
  try {
    return getSimilarIncidents(investigation, config.graphSimilarityLlmLimit).matches.map(
      ({ entityOverlap: _entityOverlap, ...match }) => match
    );
  } catch (error) {
    console.error(`Graph similarity context failed for ${investigation.id}:`, error);
    return [];
  }
}
