import type { SecurityEvent } from "../types/events.ts";
import type { EventSession } from "./sessionizer.ts";
import { inferStageForRule } from "./deterministic/stages.ts";
import type {
  AttackStage,
  CandidateTechnique,
  DeterministicEntityKeys,
  DeterministicRuleMetadata,
} from "../types/investigations.ts";

export interface EvidenceFinding {
  ruleId: string;
  weight: number;
  description: string;
  eventIds: string[];
  deterministic?: DeterministicRuleMetadata;
}

export interface EvidenceResult {
  findings: EvidenceFinding[];
  rawScore: number;
  confidence: number;
}

export const EVIDENCE_WEIGHTS = {
  bruteForce: 40,
  passwordSpray: 30,
  credentialStuffing: 35,
  successAfterFail: 28,
  mfaBypass: 30,
  mfaDisabled: 24,
  privilegeChange: 26,
  persistence: 24,
  accessRemoval: 22,
  dataExfiltration: 32,
} as const;

export function evaluateEvidence(
  events: SecurityEvent[],
  sessions: EventSession[]
): EvidenceResult {
  const sorted = [...events].sort(byTimestamp);
  const findings = [
    ...detectBruteForce(sorted),
    ...detectPasswordSpray(sorted),
    ...detectCredentialStuffing(sorted),
    ...detectSuccessAfterFail(sessions),
    ...detectMfaBypass(sessions),
    ...detectMfaDisabled(sorted),
    ...detectPrivilegeChanges(sorted),
    ...detectPersistenceEstablishment(sorted),
    ...detectAccountAccessRemoval(sorted),
    ...detectDataExfiltration(sorted),
  ];
  const rawScore = findings.reduce((sum, finding) => sum + finding.weight, 0);

  return {
    findings,
    rawScore,
    confidence: sigmoidNormalize(rawScore),
  };
}

export function sigmoidNormalize(score: number): number {
  return 1 / (1 + Math.exp(-0.08 * (score - 50)));
}

function detectBruteForce(events: SecurityEvent[]): EvidenceFinding[] {
  const failures = events.filter((event) => event.event === "failed_login");
  const byIdentity = groupBy(failures, (event) => `${event.ip}:${event.user}:${event.service}`);

  for (const [, identityEvents] of byIdentity) {
    const windows = slidingWindows(identityEvents, 5 * 60 * 1000);
    const hit = windows.find((window) => window.length >= 10);
    if (!hit) continue;

    return [
      {
        ruleId: "brute_force_10_failures_5m",
        weight: EVIDENCE_WEIGHTS.bruteForce,
        description: `Detected ${hit.length} failed login attempts for ${hit[0]?.user} from ${hit[0]?.ip} within 5 minutes.`,
        eventIds: hit.map((event) => event.id),
        deterministic: buildDeterministicMetadata(
          inferStageForRule("brute_force_10_failures_5m", hit),
          EVIDENCE_WEIGHTS.bruteForce,
          hit,
          [{ id: "T1110", name: "Brute Force" }]
        ),
      },
    ];
  }

  return [];
}

function detectPasswordSpray(events: SecurityEvent[]): EvidenceFinding[] {
  const failures = events.filter((event) => event.event === "failed_login");
  const byIp = groupBy(failures, (event) => event.ip);

  for (const [ip, ipEvents] of byIp) {
    for (const window of slidingWindows(ipEvents, 15 * 60 * 1000)) {
      const users = new Set(window.map((event) => event.user));
      if (users.size >= 10) {
        return [
          {
            ruleId: "password_spray_10_users_15m",
            weight: EVIDENCE_WEIGHTS.passwordSpray,
            description: `Detected failed logins against ${users.size} users from ${ip} within 15 minutes.`,
            eventIds: window.map((event) => event.id),
            deterministic: buildDeterministicMetadata(
              inferStageForRule("password_spray_10_users_15m", window),
              EVIDENCE_WEIGHTS.passwordSpray,
              window,
              [{ id: "T1110.003", name: "Password Spraying" }]
            ),
          },
        ];
      }
    }
  }

  return [];
}

function detectCredentialStuffing(events: SecurityEvent[]): EvidenceFinding[] {
  const failures = events.filter((event) => event.event === "failed_login");
  const windows = slidingWindows(failures, 15 * 60 * 1000);

  for (const window of windows) {
    const users = new Set(window.map((event) => event.user));
    const ips = new Set(window.map((event) => event.ip));
    const userIpPairs = new Set(window.map((event) => `${event.user}:${event.ip}`));

    if (users.size >= 10 && ips.size >= 3 && userIpPairs.size >= 15) {
      return [
        {
          ruleId: "credential_stuffing_10_users_3_ips_15m",
          weight: EVIDENCE_WEIGHTS.credentialStuffing,
          description: `Detected credential stuffing pattern across ${users.size} users and ${ips.size} IPs within 15 minutes.`,
          eventIds: window.map((event) => event.id),
          deterministic: buildDeterministicMetadata(
            inferStageForRule("credential_stuffing_10_users_3_ips_15m", window),
            EVIDENCE_WEIGHTS.credentialStuffing,
            window,
            [{ id: "T1110.004", name: "Credential Stuffing" }]
          ),
        },
      ];
    }
  }

  return [];
}

function detectSuccessAfterFail(sessions: EventSession[]): EvidenceFinding[] {
  for (const session of sessions) {
    const events = [...session.events].sort(byTimestamp);
    for (let index = 0; index < events.length; index++) {
      const current = events[index];
      if (!current || current.event !== "successful_login") continue;

      const windowStart = new Date(current.timestamp).getTime() - 10 * 60 * 1000;
      const priorFailures = events.filter(
        (event) =>
          event.event === "failed_login" &&
          new Date(event.timestamp).getTime() >= windowStart &&
          new Date(event.timestamp).getTime() <= new Date(current.timestamp).getTime()
      );

      if (priorFailures.length >= 5) {
        return [
          {
            ruleId: "success_after_fail_5_to_1_10m",
            weight: EVIDENCE_WEIGHTS.successAfterFail,
            description: `Detected ${priorFailures.length} failed logins followed by a successful login within 10 minutes.`,
            eventIds: [...priorFailures.map((event) => event.id), current.id],
            deterministic: buildDeterministicMetadata(
              inferStageForRule("success_after_fail_5_to_1_10m", [...priorFailures, current]),
              EVIDENCE_WEIGHTS.successAfterFail,
              [...priorFailures, current],
              [{ id: "T1078", name: "Valid Accounts" }]
            ),
          },
        ];
      }
    }
  }

  return [];
}

function detectMfaBypass(sessions: EventSession[]): EvidenceFinding[] {
  for (const session of sessions) {
    const events = [...session.events].sort(byTimestamp);
    for (let index = 0; index < events.length; index++) {
      const current = events[index];
      if (!current || !["mfa_success", "successful_login", "mfa_disabled"].includes(current.event)) continue;

      const windowStart = new Date(current.timestamp).getTime() - 15 * 60 * 1000;
      const priorFailures = events.filter(
        (event) =>
          event.event === "mfa_failure" &&
          new Date(event.timestamp).getTime() >= windowStart &&
          new Date(event.timestamp).getTime() <= new Date(current.timestamp).getTime()
      );

      if (priorFailures.length >= 3) {
        const hit = [...priorFailures, current];
        return [
          {
            ruleId: "mfa_bypass_3_failures_then_success_15m",
            weight: EVIDENCE_WEIGHTS.mfaBypass,
            description: `Detected ${priorFailures.length} MFA failures followed by ${current.event} within 15 minutes.`,
            eventIds: hit.map((event) => event.id),
            deterministic: buildDeterministicMetadata(
              inferStageForRule("mfa_bypass_3_failures_then_success_15m", hit),
              EVIDENCE_WEIGHTS.mfaBypass,
              hit,
              [{ id: "T1556.006", name: "Multi-Factor Authentication" }]
            ),
          },
        ];
      }
    }
  }

  return [];
}

function detectMfaDisabled(events: SecurityEvent[]): EvidenceFinding[] {
  const disabled = events.filter((event) => event.event === "mfa_disabled");
  if (disabled.length === 0) return [];

  return [
    {
      ruleId: "mfa_disabled",
      weight: EVIDENCE_WEIGHTS.mfaDisabled,
      description: `Detected ${disabled.length} MFA disable event(s).`,
      eventIds: disabled.map((event) => event.id),
      deterministic: buildDeterministicMetadata(
        inferStageForRule("mfa_disabled", disabled),
        EVIDENCE_WEIGHTS.mfaDisabled,
        disabled,
        [{ id: "T1556.006", name: "Multi-Factor Authentication" }]
      ),
    },
  ];
}

function detectPrivilegeChanges(events: SecurityEvent[]): EvidenceFinding[] {
  const changes = events.filter((event) =>
    ["role_changed", "permission_granted", "privilege_escalation"].includes(event.event)
  );
  if (changes.length === 0) return [];

  return [
    {
      ruleId: "privilege_change",
      weight: EVIDENCE_WEIGHTS.privilegeChange,
      description: `Detected ${changes.length} privilege or authorization change event(s).`,
      eventIds: changes.map((event) => event.id),
      deterministic: buildDeterministicMetadata(
        inferStageForRule("privilege_change", changes),
        EVIDENCE_WEIGHTS.privilegeChange,
        changes,
        [{ id: "T1098", name: "Account Manipulation" }]
      ),
    },
  ];
}

function detectPersistenceEstablishment(events: SecurityEvent[]): EvidenceFinding[] {
  const persistenceEvents = events.filter((event) =>
    ["api_key_created", "password_reset"].includes(event.event)
  );
  if (persistenceEvents.length === 0) return [];

  return [
    {
      ruleId: "persistence_establishment",
      weight: EVIDENCE_WEIGHTS.persistence,
      description: `Detected ${persistenceEvents.length} persistence-enabling credential or API key event(s).`,
      eventIds: persistenceEvents.map((event) => event.id),
      deterministic: buildDeterministicMetadata(
        inferStageForRule("persistence_establishment", persistenceEvents),
        EVIDENCE_WEIGHTS.persistence,
        persistenceEvents,
        [{ id: "T1098.001", name: "Additional Cloud Credentials" }]
      ),
    },
  ];
}

function detectAccountAccessRemoval(events: SecurityEvent[]): EvidenceFinding[] {
  const removals = events.filter((event) => event.event === "permission_revoked");
  if (removals.length === 0) return [];

  return [
    {
      ruleId: "account_access_removal",
      weight: EVIDENCE_WEIGHTS.accessRemoval,
      description: `Detected ${removals.length} access removal or permission revocation event(s).`,
      eventIds: removals.map((event) => event.id),
      deterministic: buildDeterministicMetadata(
        inferStageForRule("account_access_removal", removals),
        EVIDENCE_WEIGHTS.accessRemoval,
        removals,
        [{ id: "T1531", name: "Account Access Removal" }]
      ),
    },
  ];
}

function detectDataExfiltration(events: SecurityEvent[]): EvidenceFinding[] {
  const exports = events.filter((event) => event.event === "data_export");
  if (exports.length === 0) return [];

  return [
    {
      ruleId: "data_exfiltration",
      weight: EVIDENCE_WEIGHTS.dataExfiltration,
      description: `Detected ${exports.length} data export event(s).`,
      eventIds: exports.map((event) => event.id),
      deterministic: buildDeterministicMetadata(
        inferStageForRule("data_exfiltration", exports),
        EVIDENCE_WEIGHTS.dataExfiltration,
        exports,
        [{ id: "T1041", name: "Exfiltration Over C2 Channel" }]
      ),
    },
  ];
}

function buildDeterministicMetadata(
  stage: AttackStage,
  score: number,
  events: SecurityEvent[],
  techniques: CandidateTechnique[],
  capecIds: string[] = []
): DeterministicRuleMetadata {
  return {
    stage,
    score,
    confidence: sigmoidNormalize(score),
    techniques,
    capecIds,
    entityKeys: extractEntityKeys(events),
    startTime: events[0]?.timestamp,
    endTime: events[events.length - 1]?.timestamp,
  };
}

function extractEntityKeys(events: SecurityEvent[]): DeterministicEntityKeys {
  const users = unique(events.map((event) => event.user));
  const ips = unique(events.map((event) => event.ip));
  const services = unique(events.map((event) => event.service));
  const sessionIds = unique(
    events.map((event) => event.sessionId).filter((sessionId): sessionId is string => Boolean(sessionId))
  );

  return {
    users: users.length > 0 ? users : undefined,
    ips: ips.length > 0 ? ips : undefined,
    services: services.length > 0 ? services : undefined,
    sessionIds: sessionIds.length > 0 ? sessionIds : undefined,
  };
}

function slidingWindows(events: SecurityEvent[], windowMs: number): SecurityEvent[][] {
  const sorted = [...events].sort(byTimestamp);
  return sorted.map((event, index) => {
    const start = new Date(event.timestamp).getTime();
    return sorted
      .slice(index)
      .filter((candidate) => new Date(candidate.timestamp).getTime() - start <= windowMs);
  });
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function byTimestamp(a: SecurityEvent, b: SecurityEvent): number {
  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
