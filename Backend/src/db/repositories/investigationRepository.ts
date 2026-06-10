import { getDb } from "../database.ts";
import type { AlertStatus } from "../../types/alerts.ts";
import type {
  DeterministicChainEdge,
  DeterministicRuleMetadata,
  DeterministicScoreBreakdown,
  Evidence,
  IncidentGraph,
  ThreatInvestigation,
} from "../../types/investigations.ts";
import type { UebaScoreSummary } from "../../types/ueba.ts";
import { llmRepo } from "./llmRepository.ts";

export const investigationRepo = {
  insert(investigation: ThreatInvestigation): void {
    const db = getDb();
    const transaction = db.transaction(() => {
      db.run(
        `INSERT INTO investigations (
          id, project_id, title, severity, confidence, mitre, mitre_name,
          summary, recommendation, graph_json, feature_json, related_event_ids,
          created_at, status, assignee, webhook_delivered,
          deterministic_chain_json, deterministic_score_json
          , ueba_summary_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          investigation.id,
          investigation.projectId,
          investigation.title,
          investigation.severity,
          investigation.confidence,
          investigation.mitre,
          investigation.mitreName,
          investigation.summary,
          investigation.recommendation,
          JSON.stringify(investigation.graph),
          JSON.stringify(investigation.features),
          JSON.stringify(investigation.relatedEventIds),
          investigation.createdAt,
          investigation.status,
          investigation.assignee ?? null,
          investigation.webhookDelivered ? 1 : 0,
          investigation.deterministicChain ? JSON.stringify(investigation.deterministicChain) : null,
          investigation.deterministicScore ? JSON.stringify(investigation.deterministicScore) : null,
          investigation.uebaSummary ? JSON.stringify(investigation.uebaSummary) : null,
        ]
      );

      for (const evidence of investigation.evidence) {
        insertEvidence(evidence);
      }
    });

    transaction();
  },

  getAll(
    projectId: string,
    filters?: { severity?: string; status?: string }
  ): ThreatInvestigation[] {
    const db = getDb();
    let sql = "SELECT * FROM investigations WHERE project_id = ?";
    const params: any[] = [projectId];

    if (filters?.severity) {
      sql += " AND lower(severity) = lower(?)";
      params.push(filters.severity);
    }
    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }

    sql += " ORDER BY created_at DESC";

    const rows = db.query(sql).all(...params) as any[];
    return rows.map(mapInvestigationRow);
  },

  getById(id: string, projectId: string): ThreatInvestigation | null {
    const db = getDb();
    const row = db
      .query("SELECT * FROM investigations WHERE id = ? AND project_id = ?")
      .get(id, projectId) as any;
    return row ? mapInvestigationRow(row) : null;
  },

  getByIdGlobal(id: string): ThreatInvestigation | null {
    const row = getDb().query("SELECT * FROM investigations WHERE id = ?").get(id) as any;
    return row ? mapInvestigationRow(row) : null;
  },

  getAllGlobal(limit: number = 100): ThreatInvestigation[] {
    const db = getDb();
    const rows = db
      .query("SELECT * FROM investigations ORDER BY created_at DESC LIMIT ?")
      .all(limit) as any[];
    return rows.map(mapInvestigationRow);
  },

  updateStatus(id: string, projectId: string, status: AlertStatus): boolean {
    const db = getDb();
    const result = db.run(
      "UPDATE investigations SET status = ? WHERE id = ? AND project_id = ?",
      [status, id, projectId]
    );
    return result.changes > 0;
  },

  markWebhookDelivered(id: string): void {
    const db = getDb();
    db.run("UPDATE investigations SET webhook_delivered = 1 WHERE id = ?", [id]);
  },

  countBySeverity(): Record<string, number> {
    const db = getDb();
    const rows = db
      .query("SELECT severity, COUNT(*) as count FROM investigations GROUP BY severity")
      .all() as any[];
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.severity] = row.count;
    }
    return result;
  },
};

function insertEvidence(evidence: Evidence): void {
  const db = getDb();
  db.run(
    `INSERT INTO evidence (
      id, investigation_id, project_id, rule_id, weight, description, event_ids, created_at, deterministic_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      evidence.id,
      evidence.investigationId,
      evidence.projectId,
      evidence.ruleId,
      evidence.weight,
      evidence.description,
      JSON.stringify(evidence.eventIds),
      evidence.createdAt,
      evidence.deterministic ? JSON.stringify(evidence.deterministic) : null,
    ]
  );
}

function mapInvestigationRow(row: any): ThreatInvestigation {
  const investigationId = row.id as string;
  const latestReport = llmRepo.getLatest(investigationId, row.project_id);

  return {
    id: investigationId,
    projectId: row.project_id,
    title: row.title,
    severity: row.severity,
    confidence: row.confidence,
    mitre: row.mitre,
    mitreName: row.mitre_name,
    summary: row.summary,
    recommendation: row.recommendation,
    graph: safeJson<IncidentGraph>(row.graph_json, { nodes: [], edges: [] }),
    features: safeJson<Record<string, unknown>>(row.feature_json, {}),
    relatedEventIds: safeJson<string[]>(row.related_event_ids, []),
    createdAt: row.created_at,
    status: row.status,
    assignee: row.assignee ?? undefined,
    webhookDelivered: row.webhook_delivered === 1,
    evidence: getEvidence(investigationId),
    deterministicChain: row.deterministic_chain_json
      ? safeJson<DeterministicChainEdge[]>(row.deterministic_chain_json, [])
      : undefined,
    deterministicScore: row.deterministic_score_json
      ? safeJson<DeterministicScoreBreakdown>(row.deterministic_score_json, undefined as any)
      : undefined,
    uebaSummary: row.ueba_summary_json
      ? safeJson<UebaScoreSummary>(row.ueba_summary_json, undefined as any)
      : undefined,
    llmReportStatus: latestReport?.status,
    llmReport: latestReport?.report,
    llmReportError: latestReport?.error,
    llmContextVersion: latestReport?.contextVersion,
  };
}

function getEvidence(investigationId: string): Evidence[] {
  const db = getDb();
  const rows = db
    .query("SELECT * FROM evidence WHERE investigation_id = ? ORDER BY created_at ASC")
    .all(investigationId) as any[];
  return rows.map((row) => ({
    id: row.id,
    investigationId: row.investigation_id,
    projectId: row.project_id,
    ruleId: row.rule_id,
    weight: row.weight,
    description: row.description,
    eventIds: safeJson<string[]>(row.event_ids, []),
    createdAt: row.created_at,
    deterministic: row.deterministic_json
      ? safeJson<DeterministicRuleMetadata>(row.deterministic_json, undefined as any)
      : undefined,
  }));
}

function safeJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
