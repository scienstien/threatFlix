import { getDb, closeDb } from "../src/db/database.ts";
import { eventRepo } from "../src/db/repositories/eventRepository.ts";
import { investigationRepo } from "../src/db/repositories/investigationRepository.ts";
import { llmRepo } from "../src/db/repositories/llmRepository.ts";
import { analyzeEvents } from "../src/ai/analyzer.ts";
import { buildLlmIncidentContext } from "../src/ai/llmContext.ts";
import { getSimilarIncidents } from "../src/ai/graphSimilarity/service.ts";
import type { SecurityEvent } from "../src/types/events.ts";
import type { LlmChatMessage, LlmInvestigationReport } from "../src/types/llm.ts";

const DEMO = {
  userId: "demo-user-acme-india",
  projectId: "demo-customer-acme-india",
  email: "demo.customer@threatflix.local",
  password: "ThreatFlixDemo!2026",
  name: "Acme India SOC",
  apiKey: "sk-demo-acme-india-identity-telemetry",
  victim: "priya.sharma@acme-demo.in",
  attackerIp: "185.220.101.42",
  normalIp: "49.36.112.18",
  service: "acme-identity",
} as const;

async function main() {
  resetDemoTenant();
  await createDemoUser();

  const baseline = buildNormalBaseline();
  for (const event of baseline) eventRepo.insert(event);

  const scenarios = [
    { name: "similar takeover", events: buildSimilarTakeoverTimeline() },
    { name: "partial precursor", events: buildPartialTakeoverTimeline() },
    { name: "password spray", events: buildPasswordSprayTimeline() },
    { name: "isolated privilege change", events: buildIsolatedPrivilegeChangeTimeline() },
    { name: "primary full takeover", events: buildAttackTimeline() },
  ];
  const views = [];
  for (const scenario of scenarios) {
    for (const event of scenario.events) eventRepo.insert(event);
    views.push(await analyzeEvents(DEMO.projectId, scenario.events, { bypassRateLimit: true }));
  }
  const view = views[views.length - 1]!;
  const attack = scenarios[scenarios.length - 1]!.events;
  await waitForReportWorker(view.id);

  const investigation = investigationRepo.getById(view.id, DEMO.projectId);
  if (!investigation) throw new Error("Demo investigation was not persisted");

  const pendingReport = llmRepo.getLatest(investigation.id, DEMO.projectId);
  if (!pendingReport) throw new Error("Demo report job was not created");

  const similarIncidents = getSimilarIncidents(investigation, 3).matches.map(
    ({ entityOverlap: _entityOverlap, ...match }) => match
  );
  const context = buildLlmIncidentContext(
    investigation,
    attack,
    pendingReport.contextVersion,
    similarIncidents
  );
  const report = buildDemoReport(investigation.id, pendingReport.contextVersion, investigation.evidence.map((item) => item.id));
  llmRepo.complete(pendingReport.id, context, report);
  seedChat(investigation.id, pendingReport.id, pendingReport.contextVersion, investigation.evidence[0]?.id);

  console.log("\nThreatFlix demo customer seeded");
  console.log("================================");
  console.log(`Login:          ${DEMO.email}`);
  console.log(`Password:       ${DEMO.password}`);
  console.log(`Project:        ${DEMO.projectId}`);
  console.log(`Victim account: ${DEMO.victim}`);
  console.log(`Attack events:  ${attack.length}`);
  console.log(`Baseline events:${baseline.length}`);
  console.log(`Investigations: ${views.length}`);
  console.log(`Similar matches:${similarIncidents.length}`);
  console.log(`Investigation:  ${investigation.id}`);
  console.log(`Severity:       ${investigation.severity}`);
  console.log(`Confidence:     ${Math.round(investigation.confidence * 100)}%`);
  console.log(`Evidence hits:  ${investigation.evidence.length}`);
  console.log(`UEBA score:     ${investigation.uebaSummary?.behaviorScore ?? "unavailable"}`);
  console.log("================================\n");

  closeDb();
  process.exit(0);
}

function resetDemoTenant() {
  const db = getDb();
  db.transaction(() => {
    db.run("DELETE FROM investigation_chat_messages WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM investigation_llm_reports WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM evidence WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM investigations WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM alerts WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM events WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM api_keys WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM webhooks WHERE project_id = ?", [DEMO.projectId]);
    db.run("DELETE FROM users WHERE project_id = ? OR email = ?", [DEMO.projectId, DEMO.email]);
  })();
}

async function createDemoUser() {
  const db = getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO users (id, email, name, role, project_id, password_hash, created_at)
     VALUES (?, ?, ?, 'user', ?, ?, ?)`,
    [DEMO.userId, DEMO.email, DEMO.name, DEMO.projectId, await Bun.password.hash(DEMO.password), now]
  );
  db.run(
    "INSERT INTO api_keys (key, project_id, label, created_at, revoked) VALUES (?, ?, ?, ?, 0)",
    [DEMO.apiKey, DEMO.projectId, "Demo identity telemetry", now]
  );
}

function buildNormalBaseline(): SecurityEvent[] {
  const events: SecurityEvent[] = [];
  const now = Date.now();

  for (let day = 24; day >= 1; day--) {
    const sessionId = `demo-normal-${String(day).padStart(2, "0")}`;
    const start = new Date(now - day * 24 * 60 * 60 * 1000);
    start.setUTCHours(5, 15 + (day % 25), 0, 0); // 10:45-11:09 IST
    events.push(makeEvent(`normal-${day}-login`, "successful_login", start, {
      ip: DEMO.normalIp,
      sessionId,
      metadata: { mfa: true, device: "ACME-LT-1042", city: "Bengaluru", baseline: true },
    }));
    events.push(makeEvent(`normal-${day}-session`, "session_created", addSeconds(start, 3), {
      ip: DEMO.normalIp,
      sessionId,
      metadata: { device: "ACME-LT-1042", baseline: true },
    }));
    if (day % 4 === 0) {
      events.push(makeEvent(`normal-${day}-log`, "log", addSeconds(start, 240), {
        ip: DEMO.normalIp,
        sessionId,
        metadata: { action: "view_dashboard", baseline: true },
      }));
    }
    events.push(makeEvent(`normal-${day}-end`, "session_ended", addSeconds(start, 900 + day * 3), {
      ip: DEMO.normalIp,
      sessionId,
      metadata: { reason: "user_logout", baseline: true },
    }));
  }
  return events;
}

function buildAttackTimeline(): SecurityEvent[] {
  const base = new Date(Date.now() - 12 * 60 * 1000);
  const sessionId = "demo-attack-session";
  const events: SecurityEvent[] = [];

  for (let index = 0; index < 12; index++) {
    events.push(makeEvent(`attack-failure-${index + 1}`, "failed_login", addSeconds(base, index * 14), {
      ip: DEMO.attackerIp,
      sessionId,
      metadata: {
        attempt: index + 1,
        userAgent: "python-requests/2.31",
        country: "NL",
        authenticationMethod: "password",
      },
      tags: ["demo-attack", "credential-access"],
      severity: "high",
    }));
  }

  events.push(makeEvent("attack-mfa-1", "mfa_failure", addSeconds(base, 180), attackOptions(sessionId, { factor: "push" })));
  events.push(makeEvent("attack-mfa-2", "mfa_failure", addSeconds(base, 196), attackOptions(sessionId, { factor: "push" })));
  events.push(makeEvent("attack-mfa-3", "mfa_failure", addSeconds(base, 212), attackOptions(sessionId, { factor: "push" })));
  events.push(makeEvent("attack-success", "successful_login", addSeconds(base, 230), attackOptions(sessionId, {
    mfa: false,
    userAgent: "python-requests/2.31",
    country: "NL",
  })));
  events.push(makeEvent("attack-mfa-disabled", "mfa_disabled", addSeconds(base, 265), attackOptions(sessionId, {
    previousState: "required",
    newState: "disabled",
  })));
  events.push(makeEvent("attack-privilege", "privilege_escalation", addSeconds(base, 310), attackOptions(sessionId, {
    previousRole: "analyst",
    newRole: "tenant_admin",
  })));
  events.push(makeEvent("attack-api-key", "api_key_created", addSeconds(base, 350), attackOptions(sessionId, {
    keyLabel: "billing-export-automation",
    scope: "tenant:read tenant:export",
  })));
  events.push(makeEvent("attack-export", "data_export", addSeconds(base, 430), attackOptions(sessionId, {
    resource: "customer_identity_directory.csv",
    records: 18420,
    bytes: 14_800_000,
  })));
  events.push(makeEvent("attack-session-end", "session_ended", addSeconds(base, 505), attackOptions(sessionId, {
    reason: "remote_disconnect",
  })));
  return events;
}

function buildSimilarTakeoverTimeline(): SecurityEvent[] {
  const base = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const user = "arjun.mehta@acme-demo.in";
  const ip = "91.198.174.22";
  const sessionId = "demo-similar-takeover-session";
  const events: SecurityEvent[] = [];
  for (let index = 0; index < 11; index++) {
    events.push(makeEvent(`similar-failure-${index + 1}`, "failed_login", addSeconds(base, index * 16), {
      user, ip, sessionId, severity: "high", metadata: { attempt: index + 1 },
    }));
  }
  events.push(makeEvent("similar-success", "successful_login", addSeconds(base, 205), { user, ip, sessionId, severity: "critical" }));
  events.push(makeEvent("similar-mfa-disabled", "mfa_disabled", addSeconds(base, 250), { user, ip, sessionId, severity: "critical" }));
  events.push(makeEvent("similar-api-key", "api_key_created", addSeconds(base, 315), { user, ip, sessionId, severity: "critical" }));
  events.push(makeEvent("similar-export", "data_export", addSeconds(base, 390), { user, ip, sessionId, severity: "critical" }));
  return events;
}

function buildPartialTakeoverTimeline(): SecurityEvent[] {
  const base = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const user = "neha.iyer@acme-demo.in";
  const ip = "198.51.100.77";
  const sessionId = "demo-partial-takeover-session";
  const events: SecurityEvent[] = [];
  for (let index = 0; index < 10; index++) {
    events.push(makeEvent(`partial-failure-${index + 1}`, "failed_login", addSeconds(base, index * 18), {
      user, ip, sessionId, severity: "high", metadata: { attempt: index + 1 },
    }));
  }
  events.push(makeEvent("partial-success", "successful_login", addSeconds(base, 210), {
    user, ip, sessionId, severity: "critical",
  }));
  return events;
}

function buildPasswordSprayTimeline(): SecurityEvent[] {
  const base = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const ip = "203.0.113.201";
  return Array.from({ length: 12 }, (_, index) =>
    makeEvent(`spray-failure-${index + 1}`, "failed_login", addSeconds(base, index * 35), {
      user: `spray-target-${index + 1}@acme-demo.in`,
      ip,
      sessionId: `demo-spray-${index + 1}`,
      severity: "high",
      metadata: { campaign: "demo-password-spray" },
    })
  );
}

function buildIsolatedPrivilegeChangeTimeline(): SecurityEvent[] {
  const base = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return [
    makeEvent("isolated-privilege", "privilege_escalation", base, {
      user: "ops.admin@acme-demo.in",
      ip: DEMO.normalIp,
      sessionId: "demo-isolated-privilege-session",
      severity: "high",
      metadata: { previousRole: "operator", newRole: "admin" },
    }),
  ];
}

function makeEvent(
  idSuffix: string,
  event: string,
  timestamp: Date,
  options: Partial<SecurityEvent> & { metadata?: Record<string, unknown> } = {}
): SecurityEvent {
  return {
    id: `demo-${idSuffix}`,
    projectId: DEMO.projectId,
    event,
    user: options.user ?? DEMO.victim,
    ip: options.ip ?? DEMO.normalIp,
    service: options.service ?? DEMO.service,
    timestamp: timestamp.toISOString(),
    receivedAt: timestamp.toISOString(),
    metadata: options.metadata ?? {},
    severity: options.severity,
    sessionId: options.sessionId,
    tags: options.tags,
  };
}

function attackOptions(sessionId: string, metadata: Record<string, unknown>): Partial<SecurityEvent> {
  return {
    ip: DEMO.attackerIp,
    sessionId,
    metadata,
    tags: ["demo-attack", "identity-compromise"],
    severity: "critical",
  };
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

async function waitForReportWorker(investigationId: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await Bun.sleep(100);
    const row = getDb().query(
      "SELECT status FROM investigation_llm_reports WHERE investigation_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(investigationId) as { status?: string } | null;
    if (!row || row.status !== "running") return;
  }
}

function buildDemoReport(investigationId: string, contextVersion: number, evidenceIds: string[]): LlmInvestigationReport {
  return {
    schemaVersion: "1",
    contextVersion,
    provider: "ollama",
    model: "demo-seeded-report",
    generatedAt: new Date().toISOString(),
    executiveSummary: `A burst of failed logins against ${DEMO.victim} from a previously unseen IP was followed by a successful login, MFA disablement, privilege escalation, API-key creation, and a large identity-directory export.`,
    likelyIncident: "Account takeover followed by persistence establishment and data exfiltration.",
    whatLikelyHappened: [
      "The attacker repeatedly attempted the victim account from a new external IP.",
      "A successful login occurred after the failed authentication burst.",
      "The session weakened authentication controls and elevated privileges.",
      "A new API key was created before a large customer identity export.",
    ],
    evidenceAssessment: [
      {
        sourceType: "deterministic",
        referenceIds: evidenceIds,
        observation: "Multiple independently defined deterministic rules form a coherent access-to-objective chain.",
        significance: "The ordered chain provides stronger support than anomaly scoring alone.",
      },
      {
        sourceType: "ueba",
        referenceIds: [investigationId],
        observation: "The attack session differs sharply from the account's normal Bengaluru work-hour activity.",
        significance: "Behavioral deviation increases prioritization but does not independently prove compromise.",
      },
    ],
    recommendedActions: [
      { priority: "immediate", action: "Revoke the active session and newly created API key.", rationale: "Contain continued access and persistence." },
      { priority: "immediate", action: "Reset the victim credentials and restore MFA.", rationale: "Remove likely compromised authentication material." },
      { priority: "next", action: "Review the exported dataset and downstream access logs.", rationale: "Determine the scope and impact of potential data loss." },
      { priority: "monitor", action: "Block and monitor the source IP across identity services.", rationale: "Detect repeated access attempts against other accounts." },
    ],
    uncertainty: [
      "The telemetry does not establish who operated the external IP.",
      "The export content is identified by metadata but has not been independently inspected.",
    ],
    openQuestions: [
      "Was the victim expecting any login from the Netherlands?",
      "Has the newly created API key been used after the export?",
    ],
  };
}

function seedChat(investigationId: string, reportId: string, contextVersion: number, evidenceId?: string) {
  const now = new Date();
  const messages: LlmChatMessage[] = [
    {
      id: "demo-chat-analyst",
      investigationId,
      projectId: DEMO.projectId,
      reportId,
      contextVersion,
      role: "analyst",
      content: "What is the strongest evidence that this is more than a failed brute-force attempt?",
      referencedSourceIds: [],
      createdAt: new Date(now.getTime() - 1000).toISOString(),
    },
    {
      id: "demo-chat-assistant",
      investigationId,
      projectId: DEMO.projectId,
      reportId,
      contextVersion,
      role: "assistant",
      content: "The strongest evidence is the successful login followed by MFA disablement, privilege escalation, API-key creation, and data export in the same session. That progression shows post-access activity rather than only unsuccessful authentication pressure.",
      referencedSourceIds: evidenceId ? [evidenceId, "demo-attack-success", "demo-attack-api-key", "demo-attack-export"] : [],
      model: "demo-seeded-report",
      createdAt: now.toISOString(),
    },
  ];
  for (const message of messages) llmRepo.addMessage(message);
}

main().catch((error) => {
  console.error("Failed to seed ThreatFlix demo customer:", error);
  closeDb();
  process.exit(1);
});
