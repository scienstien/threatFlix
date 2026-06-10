import { getDb } from "../database.ts";
import type {
  LlmChatMessage,
  LlmIncidentContext,
  LlmInvestigationReport,
  LlmReportRecord,
  LlmReportTrigger,
} from "../../types/llm.ts";

export const llmRepo = {
  enqueue(investigationId: string, projectId: string, trigger: LlmReportTrigger, model: string): LlmReportRecord {
    const db = getDb();
    const latest = this.getLatest(investigationId, projectId);
    const record: LlmReportRecord = {
      id: crypto.randomUUID(),
      investigationId,
      projectId,
      contextVersion: (latest?.contextVersion ?? 0) + 1,
      trigger,
      status: "pending",
      attemptCount: 0,
      provider: "ollama",
      model,
      createdAt: new Date().toISOString(),
    };
    db.run(
      `INSERT INTO investigation_llm_reports
       (id, investigation_id, project_id, context_version, trigger, status, attempt_count, provider, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [record.id, investigationId, projectId, record.contextVersion, trigger, record.status, 0, "ollama", model, record.createdAt]
    );
    return record;
  },

  getLatest(investigationId: string, projectId: string): LlmReportRecord | null {
    const row = getDb().query(
      `SELECT * FROM investigation_llm_reports
       WHERE investigation_id = ? AND project_id = ?
       ORDER BY context_version DESC LIMIT 1`
    ).get(investigationId, projectId) as any;
    return row ? mapReport(row) : null;
  },

  getLatestCompleted(investigationId: string, projectId: string): LlmReportRecord | null {
    const row = getDb().query(
      `SELECT * FROM investigation_llm_reports
       WHERE investigation_id = ? AND project_id = ? AND status = 'completed'
       ORDER BY context_version DESC LIMIT 1`
    ).get(investigationId, projectId) as any;
    return row ? mapReport(row) : null;
  },

  claimNext(): LlmReportRecord | null {
    const db = getDb();
    const row = db.query(
      `SELECT * FROM investigation_llm_reports
       WHERE status = 'pending' AND attempt_count < 3 ORDER BY created_at ASC LIMIT 1`
    ).get() as any;
    if (!row) return null;
    const startedAt = new Date().toISOString();
    db.run(
      `UPDATE investigation_llm_reports SET status = 'running', attempt_count = attempt_count + 1,
       started_at = ?, error = NULL WHERE id = ? AND status = 'pending'`,
      [startedAt, row.id]
    );
    return mapReport({ ...row, status: "running", attempt_count: row.attempt_count + 1, started_at: startedAt });
  },

  complete(id: string, context: LlmIncidentContext, report: LlmInvestigationReport): void {
    getDb().run(
      `UPDATE investigation_llm_reports SET status = 'completed', context_json = ?, report_json = ?,
       completed_at = ?, error = NULL WHERE id = ?`,
      [JSON.stringify(context), JSON.stringify(report), new Date().toISOString(), id]
    );
  },

  setContext(id: string, context: LlmIncidentContext): void {
    getDb().run("UPDATE investigation_llm_reports SET context_json = ? WHERE id = ?", [
      JSON.stringify(context),
      id,
    ]);
  },

  fail(id: string, error: string, retry: boolean): void {
    getDb().run(
      `UPDATE investigation_llm_reports SET status = ?, error = ?, completed_at = ? WHERE id = ?`,
      [retry ? "pending" : "failed", error, new Date().toISOString(), id]
    );
  },

  recoverStale(): void {
    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    getDb().run(
      `UPDATE investigation_llm_reports SET status = 'pending', trigger = 'recovery',
       error = 'Recovered stale running job' WHERE status = 'running' AND started_at < ?`,
      [cutoff]
    );
  },

  addMessage(message: LlmChatMessage): void {
    getDb().run(
      `INSERT INTO investigation_chat_messages
       (id, investigation_id, project_id, report_id, context_version, role, content,
        referenced_source_ids, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [message.id, message.investigationId, message.projectId, message.reportId, message.contextVersion,
        message.role, message.content, JSON.stringify(message.referencedSourceIds), message.model ?? null, message.createdAt]
    );
  },

  getMessages(investigationId: string, projectId: string, limit = 100): LlmChatMessage[] {
    const rows = getDb().query(
      `SELECT * FROM investigation_chat_messages WHERE investigation_id = ? AND project_id = ?
       ORDER BY created_at DESC LIMIT ?`
    ).all(investigationId, projectId, limit) as any[];
    return rows.reverse().map(mapMessage);
  },
};

function mapReport(row: any): LlmReportRecord {
  return {
    id: row.id, investigationId: row.investigation_id, projectId: row.project_id,
    contextVersion: row.context_version, trigger: row.trigger, status: row.status,
    attemptCount: row.attempt_count, provider: row.provider, model: row.model,
    context: row.context_json ? JSON.parse(row.context_json) : undefined,
    report: row.report_json ? JSON.parse(row.report_json) : undefined,
    error: row.error ?? undefined, createdAt: row.created_at,
    startedAt: row.started_at ?? undefined, completedAt: row.completed_at ?? undefined,
  };
}

function mapMessage(row: any): LlmChatMessage {
  return {
    id: row.id, investigationId: row.investigation_id, projectId: row.project_id,
    reportId: row.report_id, contextVersion: row.context_version, role: row.role,
    content: row.content, referencedSourceIds: JSON.parse(row.referenced_source_ids),
    model: row.model ?? undefined, createdAt: row.created_at,
  };
}
