# SecurityAI SDK

A thin, reliable JavaScript SDK for capturing security events in your application and sending them to the SecurityAI backend for analysis.

**Version:** 0.1.0  
**Status:** Development (Hackathon)

## Features

✅ Simple event capture API  
✅ Automatic metadata attachment (app version, hostname, timestamp)  
✅ Type-safe TypeScript interfaces  
✅ Automatic HTTP retries and fail-safe design  
✅ Zero dependencies  
✅ ~2KB minified  

## Quick Start

### Installation

```bash
npm install @securityai/sdk
```

### Usage

```typescript
import SecurityAI from '@securityai/sdk';

const security = new SecurityAI({
  apiKey: 'your-api-key',
  projectId: 'your-project',
  backendUrl: 'http://localhost:3000'
});

// Capture a failed login
security.auth.failedLogin({
  user: 'admin',
  ip: '192.168.1.5'
});

// Capture a successful login
security.auth.successfulLogin({
  user: 'admin',
  ip: '192.168.1.5'
});
```

## API Reference

### Constructor

```typescript
new SecurityAI({
  apiKey: string;           // Required: API key for authentication
  projectId: string;        // Required: Project identifier
  backendUrl?: string;      // Optional: Backend URL (default: http://localhost:3000)
  appVersion?: string;      // Optional: Your app version
  hostname?: string;        // Optional: Server hostname
})
```

### Methods

#### `security.auth.failedLogin(details)`
Capture a failed authentication attempt.

```typescript
security.auth.failedLogin({
  user: 'admin',
  ip: '192.168.1.5',
  service?: 'auth-service',
  metadata?: { attemptNumber: 1 }
});
```

#### `security.auth.successfulLogin(details)`
Capture a successful authentication.

```typescript
security.auth.successfulLogin({
  user: 'john_doe',
  ip: '192.168.1.10'
});
```

#### `security.auth.passwordReset(details)`
Capture a password reset event.

```typescript
security.auth.passwordReset({
  user: 'jane_smith',
  ip: '10.0.0.5'
});
```

#### `security.log(details)`
Capture a generic security log.

```typescript
security.log({
  message: 'API quota exceeded',
  level: 'warning', // 'info' | 'warning' | 'error'
  metadata?: { quotaLimit: 1000 }
});
```

#### `security.report(details)`
Report a custom security incident.

```typescript
security.report({
  title: 'Privilege escalation detected',
  description: 'User switched to admin role without MFA',
  severity?: 'high', // 'low' | 'medium' | 'high' | 'critical'
  metadata?: { userId: 'user_123' }
});
```

#### `security.suspiciousIP(ip, context)`
Flag an IP as suspicious.

```typescript
security.suspiciousIP('203.0.113.99', {
  service: 'api',
  requestCount: 500
});
```

## Event Payload Format

All events are normalized to this format before sending to the backend:

```json
{
  "projectId": "demo-project",
  "event": "failed_login",
  "user": "admin",
  "ip": "192.168.1.5",
  "service": "auth-service",
  "timestamp": "2026-05-30T10:00:00Z",
  "metadata": {
    "appVersion": "1.0.0",
    "hostname": "server-01",
    "userAgent": "Mozilla/5.0..."
  }
}
```

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for detailed documentation.

## Examples

See the `examples/` directory for complete working examples:

- **example-auth.ts** - Basic authentication events
- **example-brute-force-demo.ts** - Simulated brute force attack (for testing/demo)
- **example-generic-events.ts** - Custom logs and reports

## Development

### Build

```bash
npm run build
```

### Watch mode

```bash
npm run dev
```

### Run examples

```bash
npx ts-node examples/example-auth.ts
npx ts-node examples/example-brute-force-demo.ts
```

## Architecture

```
SDK sends events to → Backend (Team A) → LLM Analysis → Alerts
                   ↓
              Dashboard (Team B) displays alerts
```

The SDK itself is intentionally thin:
- No local storage or caching
- No complex analysis logic
- No UI components
- Only HTTP-based communication

## Integration Guide

For team-specific integration instructions, see [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

## Type Definitions

TypeScript types are automatically generated during build. Import them from:

```typescript
import type {
  SecurityEvent,
  EventType,
  SecurityAIConfig,
  AuthEventDetails
} from '@securityai/sdk';
```

## Errors & Debugging

The SDK logs errors to the browser console:

```typescript
// In your browser console, you'll see:
[SecurityAI] Failed to send event: ...
[SecurityAI] Backend unreachable: ...
```

The SDK **never throws errors** - it logs warnings instead. This prevents your app from breaking if the security backend is down.

## License

MIT
