import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { closeDb, getDb, setDatabasePathForTests } from "../database.ts";
import { llmRepo } from "./llmRepository.ts";

const databasePath = join(process.cwd(), "data", `llm-repo-test-${crypto.randomUUID()}.db`);

beforeAll(() => {
  closeDb();
  setDatabasePathForTests(databasePath);
  const db = getDb();
  db.run(
    `INSERT INTO investigations
     (id, project_id, title, severity, confidence, mitre, mitre_name, summary, recommendation, related_event_ids, created_at)
     VALUES ('i1', 'p1', 'Test', 'High', 0.8, 'T1110', 'Brute Force', 'summary', 'action', '[]', ?)`,
    [new Date().toISOString()]
  );
});

afterAll(() => {
  closeDb();
  setDatabasePathForTests(null);
  for (const suffix of ["", "-shm", "-wal"]) {
    if (existsSync(`${databasePath}${suffix}`)) unlinkSync(`${databasePath}${suffix}`);
  }
});

describe("LLM repository", () => {
  test("versions report jobs and claims pending work", () => {
    const first = llmRepo.enqueue("i1", "p1", "initial", "gemma4:latest");
    const second = llmRepo.enqueue("i1", "p1", "manual", "gemma4:latest");
    expect(first.contextVersion).toBe(1);
    expect(second.contextVersion).toBe(2);
    expect(llmRepo.claimNext()?.status).toBe("running");
  });

  test("persists chat messages chronologically", () => {
    const report = llmRepo.getLatest("i1", "p1")!;
    llmRepo.addMessage({
      id: "m1", investigationId: "i1", projectId: "p1", reportId: report.id,
      contextVersion: report.contextVersion, role: "analyst", content: "Question",
      referencedSourceIds: [], createdAt: "2026-01-01T00:00:00Z",
    });
    llmRepo.addMessage({
      id: "m2", investigationId: "i1", projectId: "p1", reportId: report.id,
      contextVersion: report.contextVersion, role: "assistant", content: "Answer",
      referencedSourceIds: ["e1"], model: "gemma4:latest", createdAt: "2026-01-01T00:00:01Z",
    });
    expect(llmRepo.getMessages("i1", "p1").map((message) => message.id)).toEqual(["m1", "m2"]);
  });
});
