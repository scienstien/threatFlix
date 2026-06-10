import type { Severity } from "../../types/alerts.ts";
import type { EvidenceFinding } from "../evidenceEngine.ts";

const RULE_CLASSIFICATION: Record<string, { title: string; mitre: string; mitreName: string; recommendation: string }> = {
  brute_force_10_failures_5m: { title: "Brute Force", mitre: "T1110", mitreName: "Brute Force", recommendation: "Reset affected credentials, enforce MFA, and rate-limit authentication attempts." },
  password_spray_10_users_15m: { title: "Password Spraying", mitre: "T1110.003", mitreName: "Password Spraying", recommendation: "Block the source IP, review targeted users, and reset exposed credentials." },
  credential_stuffing_10_users_3_ips_15m: { title: "Credential Stuffing", mitre: "T1110.004", mitreName: "Credential Stuffing", recommendation: "Block abusive sources and force password resets for targeted accounts." },
  success_after_fail_5_to_1_10m: { title: "Successful Login After Failures", mitre: "T1078", mitreName: "Valid Accounts", recommendation: "Verify the successful login owner, rotate credentials, and inspect session activity." },
  mfa_bypass_3_failures_then_success_15m: { title: "Potential MFA Bypass", mitre: "T1556", mitreName: "Modify Authentication Process", recommendation: "Revoke active sessions and verify MFA factors with the user." },
  mfa_disabled: { title: "MFA Disabled", mitre: "T1556", mitreName: "Modify Authentication Process", recommendation: "Confirm the MFA change was authorized and re-enable MFA if unexpected." },
  privilege_change: { title: "Privilege or Account Manipulation", mitre: "T1098", mitreName: "Account Manipulation", recommendation: "Audit the account change and revoke unexpected permissions." },
  persistence_establishment: { title: "Persistence Establishment", mitre: "T1098", mitreName: "Account Manipulation", recommendation: "Review and revoke unauthorized credentials or API keys." },
  account_access_removal: { title: "Account Access Removal", mitre: "T1531", mitreName: "Account Access Removal", recommendation: "Review permission revocations and restore authorized access." },
  data_exfiltration: { title: "Data Exfiltration", mitre: "T1048", mitreName: "Exfiltration Over Alternative Protocol", recommendation: "Validate the export, preserve logs, and revoke unauthorized sessions." },
};

export function classifyDeterministicInvestigation(findings: EvidenceFinding[], finalScore: number) {
  const strongest = [...findings].sort((left, right) => right.weight - left.weight)[0];
  const classification = RULE_CLASSIFICATION[strongest?.ruleId ?? ""] ?? {
    title: "Suspicious Identity Activity",
    mitre: "T1078",
    mitreName: "Valid Accounts",
    recommendation: "Review the related telemetry and validate account activity.",
  };
  return {
    ...classification,
    summary: strongest?.description ?? "Deterministic security evidence was detected.",
    severity: severityFromScore(finalScore),
  };
}

export function severityFromScore(score: number): Severity {
  if (score >= 85) return "Critical";
  if (score >= 65) return "High";
  if (score >= 40) return "Medium";
  if (score >= 20) return "Low";
  return "Info";
}
