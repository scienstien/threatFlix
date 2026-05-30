/**
 * MITRE ATT&CK Mapping Database
 * 
 * This file contains common MITRE ATT&CK techniques relevant to security events.
 * Used by the backend AI to classify detected attacks.
 * 
 * Reference: https://attack.mitre.org/
 */

export interface MitreTechnique {
  id: string;
  name: string;
  description: string;
  tactics: string[];
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
}

export const MITRE_TECHNIQUES: Record<string, MitreTechnique> = {
  // Initial Access & Authentication
  'T1110': {
    id: 'T1110',
    name: 'Brute Force',
    description: 'Adversary attempts to access an account by guessing credentials through systematic password guessing.',
    tactics: ['Credential Access'],
    severity: 'High'
  },
  'T1078': {
    id: 'T1078',
    name: 'Valid Accounts',
    description: 'Adversary uses valid user accounts to gain access to the system.',
    tactics: ['Defense Evasion', 'Persistence', 'Privilege Escalation', 'Initial Access'],
    severity: 'High'
  },
  'T1589': {
    id: 'T1589',
    name: 'Gather Victim Identity Information',
    description: 'Adversary gathers information about target identities.',
    tactics: ['Reconnaissance'],
    severity: 'Low'
  },

  // Lateral Movement & Persistence
  'T1021': {
    id: 'T1021',
    name: 'Remote Services',
    description: 'Adversary uses remote services to establish persistence or move laterally.',
    tactics: ['Lateral Movement'],
    severity: 'High'
  },
  'T1134': {
    id: 'T1134',
    name: 'Access Token Manipulation',
    description: 'Adversary uses access tokens to escalate privileges or move laterally.',
    tactics: ['Defense Evasion', 'Privilege Escalation'],
    severity: 'Critical'
  },

  // Privilege Escalation
  'T1548': {
    id: 'T1548',
    name: 'Abuse Elevation Control Mechanism',
    description: 'Adversary abuses mechanisms for elevating privileges.',
    tactics: ['Privilege Escalation', 'Defense Evasion'],
    severity: 'Critical'
  },

  // Defense Evasion
  'T1197': {
    id: 'T1197',
    name: 'BITS Jobs',
    description: 'Adversary uses BITS jobs to download files and evade detection.',
    tactics: ['Defense Evasion', 'Persistence'],
    severity: 'Medium'
  },
  'T1036': {
    id: 'T1036',
    name: 'Masquerading',
    description: 'Adversary masquerades as legitimate processes or files.',
    tactics: ['Defense Evasion'],
    severity: 'Medium'
  },

  // Command & Control
  'T1071': {
    id: 'T1071',
    name: 'Application Layer Protocol',
    description: 'Adversary communicates with C2 over application layer protocols.',
    tactics: ['Command and Control'],
    severity: 'Medium'
  },
  'T1090': {
    id: 'T1090',
    name: 'Proxy',
    description: 'Adversary routes traffic through proxy servers.',
    tactics: ['Command and Control'],
    severity: 'Medium'
  },

  // Exfiltration
  'T1041': {
    id: 'T1041',
    name: 'Exfiltration Over C2 Channel',
    description: 'Adversary exfiltrates data through command and control channel.',
    tactics: ['Exfiltration'],
    severity: 'High'
  },
  'T1020': {
    id: 'T1020',
    name: 'Automated Exfiltration',
    description: 'Adversary exfiltrates data automatically.',
    tactics: ['Exfiltration'],
    severity: 'High'
  }
};

/**
 * Lookup helper - get technique by ID or name
 */
export function getTechnique(idOrName: string): MitreTechnique | undefined {
  if (MITRE_TECHNIQUES[idOrName]) {
    return MITRE_TECHNIQUES[idOrName];
  }
  return Object.values(MITRE_TECHNIQUES).find(
    t => t.name.toLowerCase() === idOrName.toLowerCase()
  );
}

/**
 * Get all techniques by tactic
 */
export function getTechniquesByTactic(tactic: string): MitreTechnique[] {
  return Object.values(MITRE_TECHNIQUES).filter(t =>
    t.tactics.some(ta => ta.toLowerCase() === tactic.toLowerCase())
  );
}

/**
 * Infer likely MITRE technique from attack pattern
 * Helper for Team A's AI analysis
 */
export function inferMitreTechnique(attackType: string): MitreTechnique | undefined {
  const lowerAttack = attackType.toLowerCase();
  
  if (lowerAttack.includes('brute') || lowerAttack.includes('password')) {
    return getTechnique('T1110');
  }
  if (lowerAttack.includes('lateral') || lowerAttack.includes('movement')) {
    return getTechnique('T1021');
  }
  if (lowerAttack.includes('privilege') || lowerAttack.includes('escalation')) {
    return getTechnique('T1548');
  }
  if (lowerAttack.includes('exfil')) {
    return getTechnique('T1041');
  }
  if (lowerAttack.includes('valid account') || lowerAttack.includes('valid user')) {
    return getTechnique('T1078');
  }
  if (lowerAttack.includes('proxy') || lowerAttack.includes('tunnel')) {
    return getTechnique('T1090');
  }
  
  return undefined;
}
