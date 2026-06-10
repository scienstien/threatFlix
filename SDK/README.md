# ThreatFlix TypeScript SDK

**Version 1.0.0**

A small TypeScript client for sending normalized security telemetry to ThreatFlix without coupling the
host application to detection logic.

## Design

- Type-safe canonical event payloads
- Automatic timestamp and application metadata
- Retry-aware HTTP delivery
- Fail-safe behavior: telemetry delivery failures do not break the host application
- No local detection or investigation authority

## Example

```typescript
import SecurityAI from "@scienstien/threatflix-sdk";

const security = new SecurityAI({
  apiKey: "your-api-key",
  projectId: "your-project",
  backendUrl: "http://127.0.0.1:8000",
});

await security.auth.failedLogin({
  user: "analyst@example.com",
  ip: "203.0.113.10",
  service: "identity",
});
```

## Development

```powershell
npm install
npm run build
npm test
```

The SDK only captures and transports telemetry. ThreatFlix creates investigations in the backend using
deterministic evidence, then optionally enriches them with UEBA, graph similarity, and local LLM output.
