# SecurityAI SDK Integration Guide

**Member C - SDK Responsibilities** ✅ COMPLETE

This guide explains how the SDK works and how to integrate it with other team components.

---

## Overview

The SecurityAI SDK is a **thin, reliable JavaScript/TypeScript library** that:
- Captures security events from the host application
- Normalizes them into a canonical format
- Sends them to the backend via `POST /events`
- Attaches client metadata automatically (app version, hostname, timestamp)
- Fails silently if the backend is unreachable (doesn't break the host app)

**Core principle:** The SDK only formats and forwards events. All complex logic (analysis, MITRE mapping, alerts) lives in the backend and dashboard.

---

## SDK Architecture

```
SecurityAI Class (src/index.ts)
├── Constructor: new SecurityAI({ apiKey, projectId, backendUrl, ... })
├── auth namespace
│   ├── failedLogin()
│   ├── successfulLogin()
│   └── passwordReset()
├── log()
├── report()
├── suspiciousIP()
└── Internal: _sendEvent(), _post()
```

All public methods normalize to the same event payload and send via HTTP POST.

---

## Canonical Event Payload

This is the **contract** between SDK and Backend (Team A). **Do not change this without announcing it.**

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
    "userAgent": "Mozilla/5.0...",
    "customKey": "customValue"
  }
}
```

**Fields:**
- `projectId`: String (required) - Project identifier
- `event`: String (required) - Event type (from EventType enum)
- `user`: String (optional) - Username or user ID
- `ip`: String (optional) - Source IP address
- `service`: String (optional) - Service/component name
- `timestamp`: String (required) - ISO 8601 timestamp
- `metadata`: Object (optional) - Any additional context

---

## Integration Points

### Team A (Backend)
**Must expose:**
- `POST /events` - Receive events from SDK
- `GET /alerts` - Return recent threats
- `GET /events` - Return recent events
- `GET /analyze` - Analyze event sequence with LLM

**Expected to do:**
1. Validate event payload structure
2. Store events (SQLite or in-memory)
3. Build event timelines
4. Send to LLM for analysis
5. Return threat intelligence

**Integration with SDK:**
- Backend should expect POST requests with the canonical payload above
- Include API key validation in the `Authorization: Bearer {apiKey}` header
- Return appropriate HTTP status codes (200, 400, 401, 500)

### Team B (Frontend Dashboard)
**Expected to do:**
1. Fetch `/alerts` endpoint
2. Fetch `/events` endpoint
3. Display threat cards with severity, confidence, MITRE technique
4. Show event history

**No direct SDK integration needed** - Dashboard reads from backend APIs.

**Optional:** Use the brute-force demo data to test locally with mock endpoints.

### Team D (Demo Data & MITRE)
**Use the examples:**
- `example-brute-force-demo.ts` - Run this to generate a realistic attack sequence
- `example-auth.ts` - Show normal authentication flow
- `example-generic-events.ts` - Show custom event types

**Edit the SDK config to point to your backend:**
```typescript
const security = new SecurityAI({
  apiKey: 'demo-key',
  projectId: 'demo-project',
  backendUrl: 'http://localhost:3000'  // Update this
});
```

---

## Quick Start

### 1. Import and Initialize

```typescript
import SecurityAI from '@securityai/sdk';

const security = new SecurityAI({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  backendUrl: 'http://backend-server:3000',
  appVersion: '1.0.0',
  hostname: 'my-server'
});
```

### 2. Capture Events

```typescript
// Failed login
security.auth.failedLogin({
  user: 'admin',
  ip: '192.168.1.5',
  service: 'auth-service',
  metadata: { attemptNumber: 1 }
});

// Successful login
security.auth.successfulLogin({
  user: 'admin',
  ip: '192.168.1.5'
});

// Generic log
security.log({
  message: 'API quota exceeded',
  level: 'warning'
});

// Custom report
security.report({
  title: 'Privilege escalation detected',
  severity: 'high',
  description: 'User elevated permissions'
});
```

### 3. Run Examples

```bash
# Install dependencies
cd SDK
npm install

# Build TypeScript
npm run build

# Run demo (requires backend running on localhost:3000)
npx ts-node examples/example-brute-force-demo.ts
```

---

## Key Design Decisions (For Reference)

1. **Thin SDK, smart backend:** No complex logic in the SDK. It only formats and sends.
2. **Fail silently:** If the backend is unreachable, the SDK logs a warning but doesn't throw. This prevents the SDK from breaking the host application.
3. **Modular structure:** Each event type has its own helper method, but all funnel through `_sendEvent()`. This makes it easy to add new event types without changing the core.
4. **TypeScript types:** All events are type-checked. Team A should use the same types for validation.
5. **Metadata flexibility:** The `metadata` object accepts any data, making the SDK extensible.

---

## Troubleshooting

### Events not reaching backend?
- Check that `backendUrl` is correct in SDK config
- Verify backend is running and accepting POST requests
- Check `Authorization` header - API key must match what backend expects
- Ensure `projectId` matches what backend recognizes

### Events reaching backend but not appearing in dashboard?
- Problem is likely in Team A (backend) - check their event storage
- Or Team B (frontend) - check their API integration

### SDK is slowing down my app?
- SDK sends events asynchronously (non-blocking)
- If still slow, you may be sending too many events - consider sampling or rate-limiting

### Type errors?
- Import types from `@securityai/sdk/dist/types`
- Make sure you're using the correct EventType enum values

---

## Communication & Coordination

**For any API changes:**
1. Announce changes in the shared channel before implementing
2. Update this document
3. Notify Team A (backend) and Team B (frontend)
4. Get sign-off before merging

**Shared contract files:**
- `src/types.ts` - The source of truth for all event types
- `examples/` - Reference implementations for all event scenarios

---

## File Structure

```
SDK/
├── src/
│   ├── index.ts          # Main SDK class
│   └── types.ts          # Type definitions (contract)
├── examples/
│   ├── example-auth.ts            # Auth events demo
│   ├── example-brute-force-demo.ts # Attack simulation
│   └── example-generic-events.ts  # Custom events
├── package.json
├── tsconfig.json
└── INTEGRATION_GUIDE.md  # This file
```

---

## Next Steps

1. **Team A (Backend):** Implement `POST /events` endpoint with validation against the canonical payload
2. **Team D (Demo):** Update `example-brute-force-demo.ts` with your backend URL and run it to generate test data
3. **Team B (Frontend):** After backend is ready, connect dashboard to `/alerts` and `/events` endpoints
4. **Everyone:** Test integration by running demo script and watching events flow from SDK → Backend → Dashboard

---

## Contact & Questions

- Keep SDK changes minimal and backward-compatible
- Any new event types should be added to `EventType` enum in `src/types.ts`
- If you need to modify the canonical payload structure, discuss with Team A first

Good luck with the hackathon! 🚀
