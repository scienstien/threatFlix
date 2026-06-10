import { Router } from "express";
import { authenticateJwt } from "../middleware/auth.ts";
import { investigationRepo } from "../db/repositories/investigationRepository.ts";
import { llmRepo } from "../db/repositories/llmRepository.ts";
import { enqueueManualReport } from "../ai/llmWorker.ts";
import { OllamaGemmaProvider } from "../ai/ollamaProvider.ts";
import { config } from "../config.ts";
import type { LlmChatMessage } from "../types/llm.ts";
import { getSimilarIncidents } from "../ai/graphSimilarity/service.ts";

export const investigationsRouter = Router();
const provider = new OllamaGemmaProvider();

investigationsRouter.get("/:id/similar", async (req, res) => {
  const access = resolveInvestigation(req);
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  const requestedLimit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : config.graphSimilarityApiDefaultLimit;
  try {
    return res.json(getSimilarIncidents(access.investigation, requestedLimit));
  } catch (error) {
    console.error(`Graph similarity lookup failed for ${access.investigation.id}:`, error);
    return res.json({
      schemaVersion: "1",
      algorithmVersion: "wl-subtree-cosine-v1",
      investigationId: access.investigation.id,
      matches: [],
      unavailable: true,
    });
  }
});

investigationsRouter.get("/:id/report", async (req, res) => {
  const access = resolveInvestigation(req);
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  const report = llmRepo.getLatest(access.investigation.id, access.investigation.projectId);
  return report
    ? res.json(publicReport(report))
    : res.status(404).json({ error: "LLM report not found." });
});

investigationsRouter.post("/:id/report/regenerate", async (req, res) => {
  const access = resolveInvestigation(req);
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  const report = enqueueManualReport(access.investigation.id, access.investigation.projectId);
  return res.status(202).json(publicReport(report));
});

investigationsRouter.get("/:id/chat", async (req, res) => {
  const access = resolveInvestigation(req);
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  const messages = llmRepo.getMessages(access.investigation.id, access.investigation.projectId);
  return res.json({ messages });
});

investigationsRouter.post("/:id/chat", async (req, res) => {
  const access = resolveInvestigation(req);
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > 2000) {
    return res.status(400).json({ error: "message must contain 1-2000 characters." });
  }
  const report = llmRepo.getLatestCompleted(access.investigation.id, access.investigation.projectId);
  if (!report?.context) {
    return res.status(409).json({ error: "A completed LLM report is required before chat." });
  }

  const analystMessage = buildMessage(access.investigation.id, access.investigation.projectId, report.id, report.contextVersion, "analyst", message);
  llmRepo.addMessage(analystMessage);
  try {
    const history = llmRepo
      .getMessages(access.investigation.id, access.investigation.projectId)
      .filter((item) => item.contextVersion === report.contextVersion)
      .slice(-20);
    const answer = await provider.answerQuestion(report.context, history.slice(0, -1), message);
    const assistantMessage = buildMessage(
      access.investigation.id, access.investigation.projectId, report.id, report.contextVersion,
      "assistant", answer.answer, answer.citedSourceIds, config.ollamaModel
    );
    llmRepo.addMessage(assistantMessage);
    return res.json({ message: assistantMessage, response: answer });
  } catch (error) {
    return res.status(503).json({ error: (error as Error).message, analystMessage });
  }
});

function resolveInvestigation(req: any):
  | { ok: true; investigation: NonNullable<ReturnType<typeof investigationRepo.getById>> }
  | { ok: false; status: number; error: string } {
  const auth = authenticateJwt(req);
  if (!auth) return { ok: false, status: 401, error: "Authentication required." };
  if (auth.role === "admin") {
    const investigation = investigationRepo.getByIdGlobal(req.params.id);
    return investigation
      ? { ok: true, investigation }
      : { ok: false, status: 404, error: "Investigation not found." };
  }
  const investigation = investigationRepo.getById(req.params.id, auth.projectId);
  return investigation
    ? { ok: true, investigation }
    : { ok: false, status: 404, error: "Investigation not found." };
}

function publicReport(report: NonNullable<ReturnType<typeof llmRepo.getLatest>>) {
  const { context: _context, ...visible } = report;
  return visible;
}

function buildMessage(
  investigationId: string, projectId: string, reportId: string, contextVersion: number,
  role: "analyst" | "assistant", content: string, referencedSourceIds: string[] = [], model?: string
): LlmChatMessage {
  return {
    id: crypto.randomUUID(), investigationId, projectId, reportId, contextVersion,
    role, content, referencedSourceIds, model, createdAt: new Date().toISOString(),
  };
}
