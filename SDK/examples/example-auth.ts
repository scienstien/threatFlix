/**
 * Example 1: Basic SDK Setup and Authentication Events
 * 
 * This example shows how to initialize the SDK and capture
 * common authentication-related security events.
 * 
 * Team B (Frontend) can use this as a reference for dashboard events.
 * Team A (Backend) can use this to understand what events to expect.
 */

import SecurityAI from '../src/index';

// Initialize the SDK
const security = new SecurityAI({
  apiKey: 'demo-api-key-12345',
  projectId: 'demo-project',
  backendUrl: 'http://localhost:3000',
  appVersion: '1.0.0',
  hostname: 'app-server-01'
});

// Example: Capture a failed login attempt
security.auth.failedLogin({
  user: 'admin',
  ip: '192.168.1.5',
  service: 'auth-service',
  metadata: {
    attemptNumber: 1,
    reason: 'invalid_password'
  }
});

// Example: Capture a successful login
setTimeout(() => {
  security.auth.successfulLogin({
    user: 'admin',
    ip: '192.168.1.5',
    service: 'auth-service',
    metadata: {
      mfaEnabled: true,
      sessionId: 'sess_abc123'
    }
  });
}, 2000);

// Example: Password reset event
security.auth.passwordReset({
  user: 'john_doe',
  ip: '203.0.113.42',
  service: 'identity-service',
  metadata: {
    resetMethod: 'email',
    emailDomain: 'corporate.com'
  }
});

console.log('✓ Authentication events sent to backend');
console.log('Current SDK config:', security.getConfig());
