/**
 * Example 2: Demo Attack Sequence - Brute Force
 * 
 * This example simulates a brute force attack scenario:
 * - Multiple failed login attempts from the same IP
 * - Followed by a successful login
 * - Possibly from a suspicious IP
 * 
 * Team D (Demo) should use this script to generate realistic attack events.
 * This will trigger alerts when run against the backend.
 */

import SecurityAI from '../src/index';

const security = new SecurityAI({
  apiKey: 'demo-api-key-12345',
  projectId: 'demo-project',
  backendUrl: 'http://localhost:3000',
  appVersion: '1.0.0',
  hostname: 'production-server'
});

/**
 * Simulate a brute force attack:
 * - 10 failed attempts over 30 seconds
 * - Followed by a successful login
 * - System should detect this and alert
 */
async function runBruteForceDemo() {
  console.log('🚨 Starting Brute Force Attack Demo...\n');
  
  const attackerIP = '10.0.0.99';
  const targetUser = 'admin';
  
  // Simulate rapid failed login attempts
  for (let i = 1; i <= 10; i++) {
    console.log(`[${i}/10] Failed login attempt from ${attackerIP}`);
    
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
    
    // Wait 3 seconds between attempts
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n✅ Successful login after brute force attempts\n');
  
  // After multiple failures, a successful login from the same IP
  security.auth.successfulLogin({
    user: targetUser,
    ip: attackerIP,
    service: 'auth-service',
    metadata: {
      mfaEnabled: false,
      riskScore: 0.95,
      note: 'Successful after multiple failures'
    }
  });
  
  console.log('📊 Attack sequence complete. Check dashboard for alerts.');
}

// Run the demo
runBruteForceDemo().catch(console.error);
