import { getDb } from "../database.ts";
import type {
  CanonicalIncidentGraph,
  GraphFingerprintRecord,
  IncidentGraphFingerprint,
} from "../../types/graphSimilarity.ts";

export const graphSimilarityRepo = {
  upsert(record: GraphFingerprintRecord): void {
    getDb().run(
      `INSERT INTO investigation_graph_fingerprints (
        investigation_id, project_id, schema_version, algorithm_version, iterations,
        source_scope, source_digest, canonical_graph_json, fingerprint_json, summary_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(investigation_id) DO UPDATE SET
        project_id = excluded.project_id,
        schema_version = excluded.schema_version,
        algorithm_version = excluded.algorithm_version,
        iterations = excluded.iterations,
        source_scope = excluded.source_scope,
        source_digest = excluded.source_digest,
        canonical_graph_json = excluded.canonical_graph_json,
        fingerprint_json = excluded.fingerprint_json,
        summary_json = excluded.summary_json,
        updated_at = excluded.updated_at`,
      [
        record.investigationId,
        record.projectId,
        record.fingerprint.schemaVersion,
        record.fingerprint.algorithmVersion,
        record.fingerprint.iterations,
        record.sourceScope,
        record.fingerprint.sourceDigest,
        JSON.stringify(record.canonicalGraph),
        JSON.stringify(record.fingerprint),
        JSON.stringify(record.fingerprint.summary),
        record.createdAt,
        record.updatedAt,
      ]
    );
  },

  getByInvestigation(investigationId: string, projectId: string): GraphFingerprintRecord | null {
    const row = getDb()
      .query(
        "SELECT * FROM investigation_graph_fingerprints WHERE investigation_id = ? AND project_id = ?"
      )
      .get(investigationId, projectId) as any;
    return row ? mapRow(row) : null;
  },

  getCompatibleCandidates(
    projectId: string,
    sourceInvestigationId: string,
    fingerprint: IncidentGraphFingerprint,
    limit: number
  ): GraphFingerprintRecord[] {
    const rows = getDb()
      .query(
        `SELECT * FROM investigation_graph_fingerprints
         WHERE project_id = ?
           AND investigation_id != ?
           AND schema_version = ?
           AND algorithm_version = ?
           AND iterations = ?
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .all(
        projectId,
        sourceInvestigationId,
        fingerprint.schemaVersion,
        fingerprint.algorithmVersion,
        fingerprint.iterations,
        limit
      ) as any[];
    return rows.map(mapRow).filter((row): row is GraphFingerprintRecord => Boolean(row));
  },

  countByProject(projectId: string): number {
    const row = getDb()
      .query("SELECT COUNT(*) AS count FROM investigation_graph_fingerprints WHERE project_id = ?")
      .get(projectId) as { count?: number } | null;
    return row?.count ?? 0;
  },
};

function mapRow(row: any): GraphFingerprintRecord | null {
  const canonicalGraph = safeJson<CanonicalIncidentGraph>(row.canonical_graph_json);
  const fingerprint = safeJson<IncidentGraphFingerprint>(row.fingerprint_json);
  if (!canonicalGraph || !fingerprint) return null;
  return {
    investigationId: row.investigation_id,
    projectId: row.project_id,
    sourceScope: row.source_scope,
    canonicalGraph,
    fingerprint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
