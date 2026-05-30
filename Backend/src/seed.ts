// ---------------------------------------------------------------------------
// Seed script — generates realistic demo attack scenarios.
// Run with: bun src/seed.ts
// ---------------------------------------------------------------------------

import { getDb, closeDb } from "./db/database.ts";
import { eventRepo } from "./db/repositories/eventRepository.ts";
import { analyzeEvents } from "./ai/analyzer.ts";
import type { SecurityEvent } from "./types/events.ts";

console.log("\n🌱 ThreatFlix Seed Script");
console.log("─".repeat(40));

// Initialize DB
getDb();

const PROJECT_ID = "demo-project";
const BASE_TIME = new Date();

function makeTime(minutesAgo: number): string {
  return new Date(BASE_TIME.getTime() - minutesAgo * 60_000).toISOString();
}

function makeEvent(
  overrides: Partial<SecurityEvent> & { event: string; user: string; ip: string }
): SecurityEvent {
  return {
    id: crypto.randomUUID(),
    projectId: PROJECT_ID,
    service: "auth-service",
    timestamp: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: Brute Force Attack
// 8 failed logins from rotating IPs → 1 successful login
// ---------------------------------------------------------------------------

console.log("\n📋 Scenario 1: Brute Force Attack");

const bruteForceEvents: SecurityEvent[] = [
  makeEvent({ event: "failed_login", user: "admin", ip: "45.33.32.156", timestamp: makeTime(10) }),
  makeEvent({ event: "failed_login", user: "admin", ip: "45.33.32.157", timestamp: makeTime(9.5) }),
  makeEvent({ event: "failed_login", user: "admin", ip: "45.33.32.158", timestamp: makeTime(9) }),
  makeEvent({ event: "failed_login", user: "admin", ip: "45.33.32.156", timestamp: makeTime(8.5) }),
  makeEvent({ event: "failed_login", user: "admin", ip: "45.33.32.159", timestamp: makeTime(8) }),
  makeEvent({ event: "failed_login", user: "admin", ip: "45.33.32.160", timestamp: makeTime(7.5) }),
  makeEvent({ event: "failed_login", user: "admin", ip: "45.33.32.157", timestamp: makeTime(7) }),
  makeEvent({ event: "failed_login", user: "admin", ip: "45.33.32.161", timestamp: makeTime(6.5) }),
  makeEvent({ event: "successful_login", user: "admin", ip: "45.33.32.156", timestamp: makeTime(6), metadata: { method: "password" } }),
];

for (const e of bruteForceEvents) {
  eventRepo.insert(e);
}
console.log(`  ✅ Inserted ${bruteForceEvents.length} brute force events`);

// ---------------------------------------------------------------------------
// Scenario 2: Credential Stuffing
// Multiple users, same IP, rapid failures
// ---------------------------------------------------------------------------

console.log("\n📋 Scenario 2: Credential Stuffing");

const credStuffEvents: SecurityEvent[] = [
  makeEvent({ event: "failed_login", user: "john.doe", ip: "103.21.244.0", service: "api-gateway", timestamp: makeTime(20) }),
  makeEvent({ event: "failed_login", user: "jane.smith", ip: "103.21.244.0", service: "api-gateway", timestamp: makeTime(19.8) }),
  makeEvent({ event: "failed_login", user: "bob.wilson", ip: "103.21.244.0", service: "api-gateway", timestamp: makeTime(19.6) }),
  makeEvent({ event: "failed_login", user: "alice.jones", ip: "103.21.244.0", service: "api-gateway", timestamp: makeTime(19.4) }),
  makeEvent({ event: "failed_login", user: "charlie.b", ip: "103.21.244.0", service: "api-gateway", timestamp: makeTime(19.2) }),
  makeEvent({ event: "failed_login", user: "dave.clark", ip: "103.21.244.0", service: "api-gateway", timestamp: makeTime(19) }),
  makeEvent({ event: "successful_login", user: "alice.jones", ip: "103.21.244.0", service: "api-gateway", timestamp: makeTime(18.8) }),
];

for (const e of credStuffEvents) {
  eventRepo.insert(e);
}
console.log(`  ✅ Inserted ${credStuffEvents.length} credential stuffing events`);

// ---------------------------------------------------------------------------
// Scenario 3: Privilege Escalation
// Normal login → admin access → data export
// ---------------------------------------------------------------------------

console.log("\n📋 Scenario 3: Privilege Escalation → Data Exfiltration");

const privEscEvents: SecurityEvent[] = [
  makeEvent({ event: "successful_login", user: "intern.mike", ip: "192.168.1.50", service: "web-app", timestamp: makeTime(30) }),
  makeEvent({ event: "log", user: "intern.mike", ip: "192.168.1.50", service: "web-app", timestamp: makeTime(28), metadata: { action: "viewed_dashboard" } }),
  makeEvent({ event: "privilege_escalation", user: "intern.mike", ip: "192.168.1.50", service: "admin-panel", timestamp: makeTime(25), metadata: { from: "viewer", to: "admin" } }),
  makeEvent({ event: "log", user: "intern.mike", ip: "192.168.1.50", service: "admin-panel", timestamp: makeTime(23), metadata: { action: "accessed_user_list" } }),
  makeEvent({ event: "data_export", user: "intern.mike", ip: "192.168.1.50", service: "admin-panel", timestamp: makeTime(20), metadata: { records: 15000, format: "csv" } }),
];

for (const e of privEscEvents) {
  eventRepo.insert(e);
}
console.log(`  ✅ Inserted ${privEscEvents.length} privilege escalation events`);

// ---------------------------------------------------------------------------
// Run AI analysis on each scenario
// ---------------------------------------------------------------------------

console.log("\n🧠 Running AI analysis on scenarios...\n");

try {
  const alert1 = await analyzeEvents(PROJECT_ID, bruteForceEvents);
  console.log(`  Alert 1: ${alert1.attack} (${alert1.severity}) — ${alert1.mitre}`);
} catch (err) {
  console.error("  ⚠️  Scenario 1 analysis:", (err as Error).message);
}

// Small delay to avoid cooldown
await new Promise((r) => setTimeout(r, 2000));

try {
  const alert2 = await analyzeEvents(PROJECT_ID, credStuffEvents);
  console.log(`  Alert 2: ${alert2.attack} (${alert2.severity}) — ${alert2.mitre}`);
} catch (err) {
  console.error("  ⚠️  Scenario 2 analysis:", (err as Error).message);
}

await new Promise((r) => setTimeout(r, 2000));

try {
  const alert3 = await analyzeEvents(PROJECT_ID, privEscEvents);
  console.log(`  Alert 3: ${alert3.attack} (${alert3.severity}) — ${alert3.mitre}`);
} catch (err) {
  console.error("  ⚠️  Scenario 3 analysis:", (err as Error).message);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const totalEvents = eventRepo.countAll();
console.log(`\n✅ Seeding complete!`);
console.log(`  Total events: ${totalEvents}`);
console.log(`  Run "bun run dev" to start the server.\n`);

closeDb();
