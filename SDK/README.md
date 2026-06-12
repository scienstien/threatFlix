# ThreatFlix TypeScript SDK

**Version 1.1.0**

A small TypeScript client for sending normalized security telemetry to ThreatFlix without coupling the
host application to detection logic.

## Design

- Type-safe canonical event payloads
- Automatic timestamp and application metadata
- Generic canonical event delivery for application-specific security actions
- Awaitable backend acknowledgements with accepted event IDs
- Session, severity, geolocation, tags, and custom-header support
- Fail-safe behavior: telemetry delivery failures do not break the host application
- No local detection or investigation authority

## Install

The package is published through GitHub Packages:

```powershell
npm config set @scienstien:registry https://npm.pkg.github.com
npm install @scienstien/threatflix-sdk@1.1.0
```

## Authentication Event

```typescript
import SecurityAI from "@scienstien/threatflix-sdk";

const security = new SecurityAI({
  apiKey: "your-api-key",
  projectId: "your-project",
  backendUrl: "http://127.0.0.1:8000/api",
});

await security.auth.failedLogin({
  user: "analyst@example.com",
  ip: "203.0.113.10",
  service: "identity",
});
```

## Canonical Application Event

Use `event(...)` for domain telemetry such as MFA changes, privilege changes, API-key creation, and
data exports. The returned event IDs can be used to confirm that ThreatFlix accepted the telemetry.

```typescript
const delivery = await security.event("api_key_created", {
  user: "analyst@example.com",
  ip: "203.0.113.10",
  service: "identity",
  sessionId: "session-42",
  severity: "high",
  tags: ["identity", "persistence"],
  metadata: { scope: "tenant:export" },
});

console.log(delivery?.eventIds);
```

## Release Notes

### `1.1.0`

- Added generic canonical event delivery
- Added awaitable backend acknowledgements
- Added session, severity, geolocation, tags, and custom-header support
- Corrected the documented ThreatFlix API base URL
- Added canonical delivery tests and explicit ESM package metadata

## Development

```powershell
npm install
npm run build
npm test
```

The SDK only captures and transports telemetry. ThreatFlix creates investigations in the backend using
deterministic evidence, then optionally enriches them with UEBA, graph similarity, and local LLM output.
