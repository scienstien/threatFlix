import type { SecurityEvent } from "../../types/events.ts";
import type { AttackStage } from "../../types/investigations.ts";

export const ATTACK_STAGE_ORDER: Record<AttackStage, number> = {
  access_pressure: 10,
  access_success: 20,
  persistence: 30,
  privilege_change: 40,
  objective_action: 50,
};

export function getStageOrder(stage: AttackStage): number {
  return ATTACK_STAGE_ORDER[stage];
}

export function isForwardStageTransition(from: AttackStage, to: AttackStage): boolean {
  return getStageOrder(to) > getStageOrder(from);
}

export function getStageCompatibility(from: AttackStage, to: AttackStage): number {
  if (from === to) return 0.5;
  if (isForwardStageTransition(from, to)) return 1;

  const reverseGap = getStageOrder(from) - getStageOrder(to);
  return reverseGap <= 10 ? 0.1 : 0;
}

export function inferStageForRule(ruleId: string, events: SecurityEvent[]): AttackStage {
  if (
    ruleId === "brute_force_10_failures_5m" ||
    ruleId === "password_spray_10_users_15m" ||
    ruleId === "credential_stuffing_10_users_3_ips_15m"
  ) {
    return "access_pressure";
  }

  if (
    ruleId === "success_after_fail_3_to_1_10m" ||
    ruleId === "success_after_fail_5_to_1_10m" ||
    ruleId === "mfa_bypass_3_failures_then_success_15m"
  ) {
    return "access_success";
  }

  if (
    ruleId === "risky_account_change" ||
    ruleId === "mfa_disabled" ||
    ruleId === "privilege_change" ||
    ruleId === "persistence_establishment" ||
    ruleId === "account_access_removal"
  ) {
    return inferRiskyAccountChangeStage(events);
  }

  if (ruleId === "data_exfiltration") {
    return "objective_action";
  }

  return "access_pressure";
}

function inferRiskyAccountChangeStage(events: SecurityEvent[]): AttackStage {
  if (
    events.some((event) =>
      ["role_changed", "permission_granted", "privilege_escalation"].includes(event.event)
    )
  ) {
    return "privilege_change";
  }

  if (events.some((event) => event.event === "api_key_created" || event.event === "mfa_disabled")) {
    return "persistence";
  }

  if (events.some((event) => event.event === "permission_revoked")) {
    return "privilege_change";
  }

  return "persistence";
}
