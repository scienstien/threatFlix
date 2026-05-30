/**
 * Example 3: Generic Logs and Security Reports
 * 
 * This example shows how to capture generic security events
 * and custom security reports that don't fit standard categories.
 */

import SecurityAI from '../src/index';

const security = new SecurityAI({
  apiKey: 'demo-key',
  projectId: 'demo-project',
  backendUrl: 'http://localhost:8000'
});

// Example: Generic log event
security.log({
  message: 'Suspicious API key usage detected',
  level: 'warning',
  metadata: {
    apiKeyId: 'key_abc123',
    endpoint: '/api/admin/users',
    requestsInLastMinute: 523
  }
});

// Example: High-severity security report
security.report({
  title: 'Potential Privilege Escalation',
  description: 'User switched from regular account to admin role without MFA verification',
  severity: 'high',
  metadata: {
    userId: 'user_456',
    fromRole: 'user',
    toRole: 'admin',
    timestamp: new Date().toISOString(),
    auditTrail: 'role_escalation_000123'
  }
});

// Example: Suspicious IP detection
security.suspiciousIP('203.0.113.99', {
  service: 'payment-api',
  requestCount: 1500,
  timeWindow: '5m',
  reason: 'Unusual geographic location',
  country: 'Unknown'
});

console.log('✓ Generic events sent to backend');
