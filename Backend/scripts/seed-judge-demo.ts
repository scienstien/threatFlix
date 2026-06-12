import { closeDb, getDb } from "../src/db/database.ts";
import { eventRepo } from "../src/db/repositories/eventRepository.ts";
import type { SecurityEvent } from "../src/types/events.ts";

const DEMO = {
  userId: "judge-demo-user",
  projectId: "judge-demo-northstar",
  email: "judge.demo@threatflix.local",
  password: "JudgeDemo!2026",
  name: "Northstar SOC",
  service: "northstar-identity",
} as const;

async function main() {
  resetTenant();
  await createCredentials();
  for (const event of buildBaseline()) eventRepo.insert(event);

  console.log("\nJudge demo tenant reset");
  console.log("==============================");
  console.log(`Dashboard: ${DEMO.email}`);
  console.log(`Password:  ${DEMO.password}`);
  console.log(`Project:   ${DEMO.projectId}`);
  console.log(
    hasActiveApiKey()
      ? "API key:   existing Northstar integration key preserved"
      : "API key:   generate one from ThreatFlix /integration"
  );
  console.log("==============================\n");
  closeDb();
}

function hasActiveApiKey(): boolean {
  const row = getDb()
    .query("SELECT 1 FROM api_keys WHERE project_id = ? AND revoked = 0 LIMIT 1")
    .get(DEMO.projectId);
  return Boolean(row);
}

function resetTenant() {
  const db = getDb();
  db.transaction(() => {
    db.run("DELETE FROM investigation_chat_messages WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM investigation_llm_reports WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM investigation_graph_fingerprints WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM evidence WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM investigations WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM alerts WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM events WHERE project_id = ?", [DEMO.projectId]);
    // Keep manually generated integration keys valid across demo restarts.
    // The recording flow resets incidents and telemetry, not the customer's SDK credentials.
    db.run("DELETE FROM webhooks WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM users WHERE project_id = ? OR email = ?", [DEMO.projectId, DEMO.email]);
  })();
}

async function createCredentials() {
  const now = new Date().toISOString();
  const db = getDb();
  db.run(
    `INSERT INTO users (id, email, name, role, project_id, password_hash, created_at)
     VALUES (?, ?, ?, 'user', ?, ?, ?)`,
    [DEMO.userId, DEMO.email, DEMO.name, DEMO.projectId, await Bun.password.hash(DEMO.password), now]
  );
}

function buildBaseline(): SecurityEvent[] {
  const events: SecurityEvent[] = [];
  const users = ["maya.singh", "liam.chen", "sofia.martin", "noah.williams"];
  const ips = ["49.36.112.18", "103.21.58.77", "152.58.14.32", "117.203.44.91"];
  const now = Date.now();

  for (let day = 28; day >= 1; day--) {
    for (let index = 0; index < users.length; index++) {
      const timestamp = new Date(now - day * 86_400_000);
      timestamp.setUTCHours(4 + index, 10 + (day % 24), 0, 0);
      events.push({
        id: `judge-baseline-${day}-${index}`,
        projectId: DEMO.projectId,
        event: "successful_login",
        user: `${users[index]}@northstar-demo.in`,
        ip: ips[index]!,
        service: DEMO.service,
        timestamp: timestamp.toISOString(),
        receivedAt: timestamp.toISOString(),
        sessionId: `judge-baseline-session-${day}-${index}`,
        metadata: { mfa: true, baseline: true, city: index % 2 ? "Mumbai" : "Bengaluru" },
      });
    }
  }
  return events;
}

main().catch((error) => {
  console.error("Failed to seed judge demo tenant:", error);
  closeDb();
  process.exit(1);
});
