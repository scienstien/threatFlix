import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { buildIncidentGraph } from "../../ai/incidentGraph.ts";
import { buildCanonicalIncidentGraph } from "../../ai/graphSimilarity/canonicalGraph.ts";
import { buildWlFingerprint } from "../../ai/graphSimilarity/wlFingerprint.ts";
import type { SecurityEvent } from "../../types/events.ts";
import { closeDb, getDb, setDatabasePathForTests } from "../database.ts";
import { graphSimilarityRepo } from "./graphSimilarityRepository.ts";

const databasePath = join(process.cwd(), "data", `graph-repo-test-${crypto.randomUUID()}.db`);

beforeAll(() => {
  closeDb();
  setDatabasePathForTests(databasePath);
  const db = getDb();
  for (const [id, projectId] of [["i1", "p1"], ["i2", "p1"], ["i3", "p2"]] as const) {
    db.run(
      `INSERT INTO investigations
       (id, project_id, title, severity, confidence, mitre, mitre_name, summary, recommendation, related_event_ids, created_at)
       VALUES (?, ?, 'Test', 'High', 0.8, 'T1110', 'Brute Force', 'summary', 'action', '[]', ?)`,
      [id, projectId, new Date().toISOString()]
    );
  }
});

afterAll(() => {
  closeDb();
  setDatabasePathForTests(null);
  for (const suffix of ["", "-shm", "-wal"]) {
    if (existsSync(`${databasePath}${suffix}`)) unlinkSync(`${databasePath}${suffix}`);
  }
});

describe("graph similarity repository", () => {
  test("upserts fingerprints and keeps candidates tenant-scoped", () => {
    graphSimilarityRepo.upsert(record("i1", "p1"));
    graphSimilarityRepo.upsert(record("i2", "p1"));
    graphSimilarityRepo.upsert(record("i3", "p2"));
    graphSimilarityRepo.upsert({ ...record("i1", "p1"), updatedAt: "2026-02-01T00:00:00Z" });

    const source = graphSimilarityRepo.getByInvestigation("i1", "p1")!;
    const candidates = graphSimilarityRepo.getCompatibleCandidates("p1", "i1", source.fingerprint, 10);

    expect(source.updatedAt).toBe("2026-02-01T00:00:00Z");
    expect(candidates.map((item) => item.investigationId)).toEqual(["i2"]);
    expect(graphSimilarityRepo.countByProject("p1")).toBe(2);
  });

  test("deleting an investigation cascades its fingerprint", () => {
    getDb().run("DELETE FROM investigations WHERE id = 'i2'");
    expect(graphSimilarityRepo.getByInvestigation("i2", "p1")).toBeNull();
  });
});

function record(investigationId: string, projectId: string) {
  const timestamp = "2026-01-01T00:00:00Z";
  const event: SecurityEvent = {
    id: `${investigationId}-event`, projectId, event: "failed_login", user: "alice",
    ip: "10.0.0.1", service: "identity", timestamp, receivedAt: timestamp, metadata: {},
  };
  const canonicalGraph = buildCanonicalIncidentGraph({
    sourceInvestigationId: investigationId,
    graph: buildIncidentGraph([event]),
    selectedEventIds: [event.id],
    findings: [{
      ruleId: "brute_force_10_failures_5m", eventIds: [event.id],
      deterministic: { stage: "access_pressure", techniques: [{ id: "T1110" }] },
    }],
    chainEdges: [],
  });
  return {
    investigationId, projectId, sourceScope: "selected_cluster" as const, canonicalGraph,
    fingerprint: buildWlFingerprint(canonicalGraph), createdAt: timestamp, updatedAt: timestamp,
  };
}
