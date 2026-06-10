import { describe, expect, test } from "bun:test";
import { classifyDeterministicInvestigation, severityFromScore } from "./classification.ts";

describe("deterministic investigation classification", () => {
  test("maps the strongest rule without LLM authority", () => {
    const result = classifyDeterministicInvestigation([
      { ruleId: "mfa_disabled", weight: 24, description: "MFA disabled", eventIds: ["e1"] },
      { ruleId: "data_exfiltration", weight: 32, description: "Export detected", eventIds: ["e2"] },
    ], 70);

    expect(result.title).toBe("Data Exfiltration");
    expect(result.severity).toBe("High");
    expect(result.mitre).toBe("T1048");
    expect(result.summary).toBe("Export detected");
  });

  test("uses locked severity thresholds", () => {
    expect(severityFromScore(85)).toBe("Critical");
    expect(severityFromScore(65)).toBe("High");
    expect(severityFromScore(40)).toBe("Medium");
    expect(severityFromScore(20)).toBe("Low");
    expect(severityFromScore(19.99)).toBe("Info");
  });
});
