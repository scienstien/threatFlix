/**
 * Demo Runner & Orchestrator
 * 
 * This script runs the complete SecurityAI demo:
 * 1. Initializes SDK with backend connection
 * 2. Runs attack scenarios in sequence
 * 3. Shows expected outputs
 * 4. Provides timing for live demo
 * 
 * Usage:
 *   npx ts-node runner.ts --backend http://localhost:3000
 *   npx ts-node runner.ts --scenario brute-force
 *   npx ts-node runner.ts --all
 */

import SecurityAI from '../SDK/src/index';
import {
  scenario_bruteForce,
  scenario_lateralMovement,
  scenario_privilegeEscalation,
  scenario_credentialStuffing,
  scenario_suspiciousIP,
  runAllScenarios
} from './attack-scenarios';

/**
 * Parse command-line arguments
 */
interface DemoOptions {
  backend: string;
  scenario?: string;
  all: boolean;
  verbose: boolean;
  delay: number;
}

function parseArgs(): DemoOptions {
  const args = process.argv.slice(2);
  const options: DemoOptions = {
    backend: 'http://localhost:8000',
    all: false,
    verbose: true,
    delay: 1000
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--backend':
        options.backend = args[++i];
        break;
      case '--scenario':
        options.scenario = args[++i];
        break;
      case '--all':
        options.all = true;
        break;
      case '--quiet':
        options.verbose = false;
        break;
      case '--delay':
        options.delay = parseInt(args[++i]);
        break;
    }
  }

  return options;
}

/**
 * Main demo execution
 */
async function runDemo(options: DemoOptions) {
  console.log('\n📊 SecurityAI Demo Runner');
  console.log(`Backend URL: ${options.backend}\n`);

  // Initialize SDK
  const security = new SecurityAI({
    apiKey: 'demo-key',
    projectId: 'demo-project',
    backendUrl: options.backend,
    appVersion: '1.0.0',
    hostname: 'demo-machine'
  });

  try {
    if (options.all) {
      // Run all scenarios
      await runAllScenarios(security, {
        verbose: options.verbose,
        delay: options.delay
      });
    } else if (options.scenario) {
      // Run specific scenario
      switch (options.scenario.toLowerCase()) {
        case 'brute-force':
        case 'brute':
          await scenario_bruteForce(security, { verbose: options.verbose });
          break;
        case 'lateral':
        case 'lateral-movement':
          await scenario_lateralMovement(security, { verbose: options.verbose });
          break;
        case 'privilege':
        case 'escalation':
        case 'privesc':
          await scenario_privilegeEscalation(security, { verbose: options.verbose });
          break;
        case 'stuffing':
        case 'credential-stuffing':
          await scenario_credentialStuffing(security, { verbose: options.verbose });
          break;
        case 'suspicious':
        case 'suspicious-ip':
          await scenario_suspiciousIP(security, { verbose: options.verbose });
          break;
        default:
          console.log(`Unknown scenario: ${options.scenario}`);
          console.log('Available: brute-force, lateral-movement, escalation, stuffing, suspicious-ip');
      }
    } else {
      // Show usage
      printUsage();
    }

    console.log('\n✓ Demo completed. Check the dashboard for alerts!\n');
  } catch (error) {
    console.error('Error running demo:', error);
    process.exit(1);
  }
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Usage: bun run runner.ts [OPTIONS]

Options:
  --backend <url>        Backend URL (default: http://localhost:8000)
  --scenario <name>      Run specific scenario:
                         - brute-force
                         - lateral-movement
                         - escalation
                         - credential-stuffing
                         - suspicious-ip
  --all                  Run all scenarios in sequence
  --delay <ms>           Delay between scenarios (default: 1000ms)
  --quiet                Suppress console output

Examples:
  bun run runner.ts --backend http://localhost:3000 --scenario brute-force
  bun run runner.ts --all --delay 2000
  bun run runner.ts --scenario lateral-movement --backend https://api.example.com

Demo Script Timing (for live presentation):
  - Each scenario: 3-5 seconds
  - Total demo time: ~30 seconds
  - Recommended: Run --all with default settings
`);
}

/**
 * Expected outputs for each scenario (for Team A & B reference)
 */
export const EXPECTED_OUTPUTS = {
  bruteForce: {
    attack: 'Brute Force Attack',
    severity: 'High',
    confidence: 0.95,
    mitre: 'T1110',
    reasoning:
      '10 rapid failed login attempts from single IP 10.0.0.99, followed by successful authentication on admin account. Pattern indicates credential compromise via password guessing.',
    recommendation:
      'Immediately reset admin password, enable MFA, block IP 10.0.0.99, review all successful admin logins in last 24 hours'
  },

  lateralMovement: {
    attack: 'Lateral Movement & Data Exfiltration',
    severity: 'Critical',
    confidence: 0.88,
    mitre: 'T1021, T1041',
    reasoning:
      'Valid database admin account accessed from unusual internal network segment. Followed by large bulk query (5000 records) and export to external IP. Activity pattern matches data theft.',
    recommendation:
      'Isolate affected systems, revoke database credentials, investigate destination IP 10.0.0.150, check DLP alerts for data exfiltration'
  },

  privilegeEscalation: {
    attack: 'Privilege Escalation Attempt',
    severity: 'Critical',
    confidence: 0.92,
    mitre: 'T1548',
    reasoning:
      'Low-privilege contractor account (contractor) attempted multiple sudo commands, followed by successful privilege escalation to root. Indicates vulnerability exploitation or credential bypass.',
    recommendation:
      'Immediately revoke contractor access, audit sudo vulnerability, patch system, review all privileged commands executed by this user, run integrity checks on system binaries'
  },

  credentialStuffing: {
    attack: 'Credential Stuffing Attack',
    severity: 'High',
    confidence: 0.87,
    mitre: 'T1110',
    reasoning:
      '15 rapid login failures across common usernames (admin, root, test, guest, user) from multiple external IPs (203.0.113.x range). Pattern matches automated credential dump attack.',
    recommendation:
      'Block all IPs in 203.0.113.0/24, enable rate limiting on login endpoint, require CAPTCHA after 3 failures, monitor for account compromise indicators'
  },

  suspiciousIP: {
    attack: 'Malicious IP - Reconnaissance',
    severity: 'High',
    confidence: 0.91,
    mitre: 'T1589',
    reasoning:
      'Login attempts from IP 103.145.90.88 (North Korea, blacklist match). Multiple failed attempts to access support, billing, and finance accounts. Aligns with threat intel data on known C2.',
    recommendation:
      'Block IP 103.145.90.88 globally, add to firewall blacklist, audit similar IPs, check for any successful compromises from this range, enable geographic access restrictions'
  }
};

// Run if executed directly (Bun ESM equivalent of require.main === module)
if ((import.meta as any).main) {
  const options = parseArgs();
  runDemo(options);
}

export { runDemo, parseArgs };
