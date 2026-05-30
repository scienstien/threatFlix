// ---------------------------------------------------------------------------
// MITRE ATT&CK lookup dictionary — compact version for hackathon.
// Forward-compat: replace with full STIX data or API integration.
// ---------------------------------------------------------------------------

export interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
  description: string;
  url: string;
}

/** Compact lookup of common MITRE ATT&CK techniques relevant to authentication
 *  and application-layer attacks. */
export const MITRE_TECHNIQUES: Record<string, MitreTechnique> = {
  T1110: {
    id: "T1110",
    name: "Brute Force",
    tactic: "Credential Access",
    description:
      "Adversaries may use brute force techniques to attempt access to accounts when passwords are unknown or when password hashes are obtained.",
    url: "https://attack.mitre.org/techniques/T1110/",
  },
  "T1110.001": {
    id: "T1110.001",
    name: "Password Guessing",
    tactic: "Credential Access",
    description:
      "Adversaries may guess passwords to attempt access to accounts using common passwords or contextual information.",
    url: "https://attack.mitre.org/techniques/T1110/001/",
  },
  "T1110.003": {
    id: "T1110.003",
    name: "Password Spraying",
    tactic: "Credential Access",
    description:
      "Adversaries may use a single or small list of commonly used passwords against many accounts to attempt to acquire valid credentials.",
    url: "https://attack.mitre.org/techniques/T1110/003/",
  },
  "T1110.004": {
    id: "T1110.004",
    name: "Credential Stuffing",
    tactic: "Credential Access",
    description:
      "Adversaries may use credentials obtained from breach databases to gain access through credential overlap.",
    url: "https://attack.mitre.org/techniques/T1110/004/",
  },
  T1078: {
    id: "T1078",
    name: "Valid Accounts",
    tactic: "Defense Evasion, Persistence, Privilege Escalation, Initial Access",
    description:
      "Adversaries may obtain and abuse credentials of existing accounts to gain initial access, persistence, or privilege escalation.",
    url: "https://attack.mitre.org/techniques/T1078/",
  },
  T1098: {
    id: "T1098",
    name: "Account Manipulation",
    tactic: "Persistence",
    description:
      "Adversaries may manipulate accounts to maintain or elevate access to victim systems.",
    url: "https://attack.mitre.org/techniques/T1098/",
  },
  T1136: {
    id: "T1136",
    name: "Create Account",
    tactic: "Persistence",
    description:
      "Adversaries may create an account to maintain access to victim systems.",
    url: "https://attack.mitre.org/techniques/T1136/",
  },
  T1531: {
    id: "T1531",
    name: "Account Access Removal",
    tactic: "Impact",
    description:
      "Adversaries may interrupt availability of system and network resources by inhibiting access to accounts used by legitimate users.",
    url: "https://attack.mitre.org/techniques/T1531/",
  },
  T1556: {
    id: "T1556",
    name: "Modify Authentication Process",
    tactic: "Credential Access, Defense Evasion, Persistence",
    description:
      "Adversaries may modify authentication mechanisms and processes to access credentials or enable otherwise unwarranted access.",
    url: "https://attack.mitre.org/techniques/T1556/",
  },
  T1021: {
    id: "T1021",
    name: "Remote Services",
    tactic: "Lateral Movement",
    description:
      "Adversaries may use valid accounts to log into a service specifically designed to accept remote connections.",
    url: "https://attack.mitre.org/techniques/T1021/",
  },
  T1087: {
    id: "T1087",
    name: "Account Discovery",
    tactic: "Discovery",
    description:
      "Adversaries may attempt to get a listing of accounts on a system or within an environment.",
    url: "https://attack.mitre.org/techniques/T1087/",
  },
  T1040: {
    id: "T1040",
    name: "Network Sniffing",
    tactic: "Credential Access, Discovery",
    description:
      "Adversaries may sniff network traffic to capture information about an environment, including authentication material.",
    url: "https://attack.mitre.org/techniques/T1040/",
  },
  T1557: {
    id: "T1557",
    name: "Adversary-in-the-Middle",
    tactic: "Credential Access, Collection",
    description:
      "Adversaries may attempt to position themselves between two or more networked devices to support follow-on behaviors.",
    url: "https://attack.mitre.org/techniques/T1557/",
  },
  T1071: {
    id: "T1071",
    name: "Application Layer Protocol",
    tactic: "Command and Control",
    description:
      "Adversaries may communicate using application layer protocols to avoid detection and blend in with existing traffic.",
    url: "https://attack.mitre.org/techniques/T1071/",
  },
  T1048: {
    id: "T1048",
    name: "Exfiltration Over Alternative Protocol",
    tactic: "Exfiltration",
    description:
      "Adversaries may steal data by exfiltrating it over a different protocol than the existing command and control channel.",
    url: "https://attack.mitre.org/techniques/T1048/",
  },
  T1537: {
    id: "T1537",
    name: "Transfer Data to Cloud Account",
    tactic: "Exfiltration",
    description:
      "Adversaries may exfiltrate data by transferring it to another cloud account they control.",
    url: "https://attack.mitre.org/techniques/T1537/",
  },
  T1530: {
    id: "T1530",
    name: "Data from Cloud Storage",
    tactic: "Collection",
    description:
      "Adversaries may access data from improperly secured cloud storage.",
    url: "https://attack.mitre.org/techniques/T1530/",
  },
  T1552: {
    id: "T1552",
    name: "Unsecured Credentials",
    tactic: "Credential Access",
    description:
      "Adversaries may search compromised systems to find and obtain insecurely stored credentials.",
    url: "https://attack.mitre.org/techniques/T1552/",
  },
  T1133: {
    id: "T1133",
    name: "External Remote Services",
    tactic: "Initial Access, Persistence",
    description:
      "Adversaries may leverage external-facing remote services to initially access or persist within a network.",
    url: "https://attack.mitre.org/techniques/T1133/",
  },
  T1190: {
    id: "T1190",
    name: "Exploit Public-Facing Application",
    tactic: "Initial Access",
    description:
      "Adversaries may attempt to exploit a weakness in an Internet-facing application to gain access.",
    url: "https://attack.mitre.org/techniques/T1190/",
  },
  T1068: {
    id: "T1068",
    name: "Exploitation for Privilege Escalation",
    tactic: "Privilege Escalation",
    description:
      "Adversaries may exploit software vulnerabilities to elevate privileges.",
    url: "https://attack.mitre.org/techniques/T1068/",
  },
  T1499: {
    id: "T1499",
    name: "Endpoint Denial of Service",
    tactic: "Impact",
    description:
      "Adversaries may perform Endpoint Denial of Service attacks to degrade or block availability.",
    url: "https://attack.mitre.org/techniques/T1499/",
  },
  T1562: {
    id: "T1562",
    name: "Impair Defenses",
    tactic: "Defense Evasion",
    description:
      "Adversaries may disable security tools to avoid detection of their activities.",
    url: "https://attack.mitre.org/techniques/T1562/",
  },
  T1027: {
    id: "T1027",
    name: "Obfuscated Files or Information",
    tactic: "Defense Evasion",
    description:
      "Adversaries may obfuscate payloads or files to make detection and analysis more difficult.",
    url: "https://attack.mitre.org/techniques/T1027/",
  },
};

/** Look up a MITRE technique by ID, with fuzzy matching. */
export function lookupMitre(id: string): MitreTechnique | undefined {
  // Exact match
  if (MITRE_TECHNIQUES[id]) return MITRE_TECHNIQUES[id];

  // Try parent technique (e.g. "T1110.001" → "T1110")
  const parent = id.split(".")[0];
  if (parent && MITRE_TECHNIQUES[parent]) return MITRE_TECHNIQUES[parent];

  return undefined;
}

/** Validate and enrich a MITRE ID returned by the LLM. */
export function enrichMitre(
  id: string,
  name: string
): { mitre: string; mitreName: string; mitreUrl: string } {
  const technique = lookupMitre(id);

  if (technique) {
    return {
      mitre: technique.id,
      mitreName: technique.name,
      mitreUrl: technique.url,
    };
  }

  // LLM returned an ID we don't know — keep it but flag it
  return {
    mitre: id || "Unknown",
    mitreName: name || "Unknown Technique",
    mitreUrl: id ? `https://attack.mitre.org/techniques/${id.replace(".", "/")}/` : "",
  };
}
