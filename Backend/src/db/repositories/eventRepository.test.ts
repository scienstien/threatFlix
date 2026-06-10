import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { closeDb, getDb, setDatabasePathForTests } from "../database.ts";
import { alertRepo } from "./alertRepository.ts";
import { eventRepo } from "./eventRepository.ts";
import type { SecurityEvent } from "../../types/events.ts";

const projectId = `event-repo-test-${crypto.randomUUID()}`;
const testDatabasePath = join(process.cwd(), "data", `repository-test-${crypto.randomUUID()}.db`);

beforeAll(() => {
  closeDb();
  setDatabasePathForTests(testDatabasePath);
  getDb();
});

afterAll(() => {
  closeDb();
  setDatabasePathForTests(null);
  removeTestDatabaseFiles();
});

describe("event repository", () => {
  test("excludes events linked to investigations from unanalysed events", () => {
    const event = buildEvent();
    eventRepo.insert(event);

    const db = getDb();
    insertInvestigation(db, event.id);

    expect(eventRepo.getUnanalysed(projectId).map((item) => item.id)).not.toContain(event.id);
  });

  test("legacy alert severity filters are case-insensitive", () => {
    const alertId = crypto.randomUUID();
    alertRepo.insert({
      id: alertId,
      projectId,
      attack: "Repository test",
      severity: "High",
      confidence: 0.5,
      mitre: "T1078",
      mitreName: "Valid Accounts",
      reasoning: "Test alert",
      recommendation: "Review activity",
      relatedEventIds: [],
      createdAt: new Date().toISOString(),
      status: "open",
      webhookDelivered: false,
    });

    expect(alertRepo.getAll(projectId, { severity: "high" }).map((item) => item.id)).toContain(
      alertId
    );
  });
});

function buildEvent(): SecurityEvent {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    event: "failed_login",
    user: "repo-test@example.com",
    ip: "203.0.113.10",
    service: "auth",
    timestamp,
    receivedAt: timestamp,
    metadata: {},
  };
}

function insertInvestigation(db: Database, eventId: string): void {
  db.run(
    `INSERT INTO investigations (
      id, project_id, title, severity, confidence, mitre, mitre_name,
      summary, recommendation, related_event_ids, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      projectId,
      "Repository test",
      "Low",
      0.5,
      "T1078",
      "Valid Accounts",
      "Test investigation",
      "Review activity",
      JSON.stringify([eventId]),
      new Date().toISOString(),
    ]
  );
}

function removeTestDatabaseFiles(): void {
  for (const suffix of ["", "-shm", "-wal"]) {
    const path = `${testDatabasePath}${suffix}`;
    if (existsSync(path)) unlinkSync(path);
  }
}
