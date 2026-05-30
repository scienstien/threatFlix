/**
 * Demo Attack Scenarios
 * 
 * These are realistic attack sequences that Team D uses to demo the system.
 * Each scenario generates events via the SecurityAI SDK.
 * 
 * Scenarios:
 * 1. Brute Force Attack - Multiple failed logins from external IP
 * 2. Lateral Movement - Valid account used from unusual location
 * 3. Privilege Escalation - Suspicious commands run by low-privilege user
 * 4. Data Exfiltration - Bulk download activity with anomalous patterns
 * 5. Credential Stuffing - High volume of login attempts with different IPs
 */

import SecurityAI from '../SDK/dist/index.js';

/**
 * Scenario 1: Brute Force Attack
 * Multiple failed login attempts followed by success = compromised credential
 */
export async function scenario_bruteForce(
  security: SecurityAI,
  options: { verbose?: boolean } = {}
) {
  const verbose = options.verbose !== false;
  if (verbose) console.log('\n🚨 SCENARIO 1: BRUTE FORCE ATTACK');
  if (verbose) console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (verbose) console.log('10 failed login attempts from 10.0.0.99, then success\n');

  const attackerIP = '10.0.0.99';
  const targetUser = 'admin';

  // Simulate 10 rapid failed attempts
  for (let i = 1; i <= 10; i++) {
    if (verbose) console.log(`  [${i}/10] Failed login: ${targetUser}@${attackerIP}`);
    security.auth.failedLogin({
      user: targetUser,
      ip: attackerIP,
      service: 'auth-service',
      metadata: {
        attemptNumber: i,
        reason: 'invalid_password',
        duration_ms: 245 + Math.random() * 100
      }
    });
    await new Promise(r => setTimeout(r, 100));
  }

  // Followed by successful login
  if (verbose) console.log(`  [SUCCESS] Successful login: ${targetUser}@${attackerIP}`);
  security.auth.successfulLogin({
    user: targetUser,
    ip: attackerIP,
    service: 'auth-service',
    metadata: {
      sessionDuration: 1800,
      method: 'password'
    }
  });

  if (verbose) console.log('\n✓ Events sent to backend\n');
}

/**
 * Scenario 2: Lateral Movement
 * Compromised account used from geographically impossible location
 */
export async function scenario_lateralMovement(
  security: SecurityAI,
  options: { verbose?: boolean } = {}
) {
  const verbose = options.verbose !== false;
  if (verbose) console.log('\n🚨 SCENARIO 2: LATERAL MOVEMENT');
  if (verbose) console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (verbose) console.log('Valid account login from unexpected location\n');

  const validUser = 'dbadmin';
  const suspiciousIP = '192.168.50.15'; // Internal network, unusual for this user

  // Login from suspicious internal IP
  if (verbose) console.log(`  [1] Valid account logged in: ${validUser}@${suspiciousIP}`);
  security.auth.successfulLogin({
    user: validUser,
    ip: suspiciousIP,
    service: 'database-service',
    metadata: {
      location: 'Internal Network Segment',
      isUnusual: true,
      daysSinceLast: 0,
      deviation: 'unusual_location'
    }
  });
  await new Promise(r => setTimeout(r, 200));

  // Suspicious activity on databases
  if (verbose) console.log(`  [2] Database query: SELECT * FROM users`);
  security.log({
    message: 'Large database query executed by unusual account',
    level: 'warning',
    metadata: {
      user: validUser,
      service: 'database-service',
      query: 'SELECT * FROM users',
      resultCount: 5000,
      executionTime_ms: 345
    }
  });
  await new Promise(r => setTimeout(r, 200));

  if (verbose) console.log(`  [3] Bulk data export initiated`);
  security.report({
    title: 'Bulk Data Export Detected',
    description: 'Large volume of data exported from database service',
    severity: 'high',
    metadata: {
      user: validUser,
      service: 'database-service',
      eventType: 'bulk_export',
      recordsExported: 5000,
      destinationIP: '10.0.0.150',
      format: 'CSV'
    }
  });

  if (verbose) console.log('\n✓ Events sent to backend\n');
}

/**
 * Scenario 3: Privilege Escalation
 * Low-privilege user attempts to run privileged commands
 */
export async function scenario_privilegeEscalation(
  security: SecurityAI,
  options: { verbose?: boolean } = {}
) {
  const verbose = options.verbose !== false;
  if (verbose) console.log('\n🚨 SCENARIO 3: PRIVILEGE ESCALATION');
  if (verbose) console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (verbose) console.log('Low-privilege user attempting admin commands\n');

  const lowPrivUser = 'contractor';
  const systemIP = '192.168.1.10';

  // Multiple failed sudo attempts
  for (let i = 1; i <= 3; i++) {
    if (verbose) console.log(`  [${i}/3] sudo command failed: ${lowPrivUser}`);
    security.log({
      message: `Sudo command failed for low-privilege user (attempt ${i})`,
      level: 'error',
      metadata: {
        user: lowPrivUser,
        ip: systemIP,
        service: 'system-audit',
        command: 'sudo service nginx restart',
        reason: 'permission_denied',
        attempt: i
      }
    });
    await new Promise(r => setTimeout(r, 150));
  }

  // Then a successful escalation
  if (verbose) console.log(`  [SUCCESS] Privilege escalation detected`);
  security.report({
    title: 'Privilege Escalation Attempt Detected',
    description: 'Low-privilege user successfully escalated to root via sudo vulnerability',
    severity: 'critical',
    metadata: {
      user: lowPrivUser,
      ip: systemIP,
      service: 'system-audit',
      eventType: 'privilege_escalation',
      method: 'sudo_vulnerability',
      newPrivilegeLevel: 'root',
      suspicion: 'high'
    }
  });

  if (verbose) console.log('\n✓ Events sent to backend\n');
}

/**
 * Scenario 4: Credential Stuffing
 * High volume of login attempts from multiple IPs with different credentials
 */
export async function scenario_credentialStuffing(
  security: SecurityAI,
  options: { verbose?: boolean } = {}
) {
  const verbose = options.verbose !== false;
  if (verbose) console.log('\n🚨 SCENARIO 4: CREDENTIAL STUFFING');
  if (verbose) console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (verbose) console.log('Rapid login attempts with different credentials\n');

  const commonUsers = ['admin', 'root', 'test', 'guest', 'user'];
  const ips = ['203.0.113.45', '203.0.113.46', '203.0.113.47'];

  // 15 rapid failed attempts
  for (let i = 0; i < 15; i++) {
    const user = commonUsers[i % commonUsers.length];
    const ip = ips[i % ips.length];

    if (verbose && i % 3 === 0) console.log(`  Attempt ${i + 1}: ${user}@${ip}`);

    security.auth.failedLogin({
      user,
      ip,
      service: 'auth-service',
      metadata: {
        attemptNumber: i + 1,
        reason: 'invalid_password',
        duration_ms: 250,
        fromList: 'credential_dump'
      }
    });

    await new Promise(r => setTimeout(r, 80));
  }

  if (verbose) console.log(`\n✓ ${15} failed attempts logged\n`);
}

/**
 * Scenario 5: Suspicious IP Activity
 * Multiple login attempts from blacklisted or suspicious geolocation
 */
export async function scenario_suspiciousIP(
  security: SecurityAI,
  options: { verbose?: boolean } = {}
) {
  const verbose = options.verbose !== false;
  if (verbose) console.log('\n🚨 SCENARIO 5: SUSPICIOUS IP ACTIVITY');
  if (verbose) console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (verbose) console.log('Login attempts from known malicious IP\n');

  const suspiciousIP = '103.145.90.88'; // Example: Known botnet C2
  const users = ['support', 'billing', 'finance'];

  for (let i = 0; i < users.length; i++) {
    if (verbose) console.log(`  [${i + 1}] Login attempt: ${users[i]}@${suspiciousIP}`);

    security.auth.failedLogin({
      user: users[i],
      ip: suspiciousIP,
      service: 'auth-service',
      metadata: {
        geoIP_country: 'KP',
        geoIP_risk: 'high',
        isBlacklisted: true,
        reputationScore: 0.05
      }
    });

    await new Promise(r => setTimeout(r, 200));
  }

  // Flag the IP
  if (verbose) console.log(`\n  [ALERT] Blocking suspicious IP`);
  security.suspiciousIP(suspiciousIP, {
    reason: 'blacklist_match',
    threatIntel: 'KnownC2',
    actionTaken: 'blocked'
  });

  if (verbose) console.log('\n✓ Events sent to backend\n');
}

/**
 * Run all scenarios sequentially
 */
export async function runAllScenarios(
  security: SecurityAI,
  options: { verbose?: boolean; delay?: number } = {}
) {
  const verbose = options.verbose !== false;
  const delayMs = options.delay || 1000;

  if (verbose) {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║       SecurityAI DEMO - ALL ATTACK SCENARIOS       ║');
    console.log('║         5 Realistic Threats in Sequence            ║');
    console.log('╚════════════════════════════════════════════════════╝');
  }

  await scenario_bruteForce(security, { verbose });
  await new Promise(r => setTimeout(r, delayMs));

  await scenario_lateralMovement(security, { verbose });
  await new Promise(r => setTimeout(r, delayMs));

  await scenario_privilegeEscalation(security, { verbose });
  await new Promise(r => setTimeout(r, delayMs));

  await scenario_credentialStuffing(security, { verbose });
  await new Promise(r => setTimeout(r, delayMs));

  await scenario_suspiciousIP(security, { verbose });

  if (verbose) {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║          ✓ ALL SCENARIOS COMPLETED                ║');
    console.log('║     Check dashboard for detected alerts/threats    ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
  }
}
