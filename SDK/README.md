# ThreatFlix SDK

[![npm](https://img.shields.io/npm/v/threatflix-sdk?style=flat-square)](https://www.npmjs.com/package/threatflix-sdk)
[![license](https://img.shields.io/npm/l/threatflix-sdk?style=flat-square)](https://github.com/scienstien/threatFlix)

**Send security-relevant application events to ThreatFlix without embedding detection logic in your app.**

`threatflix-sdk` is a small TypeScript client for instrumenting authentication, identity, privilege, and
data-access activity. It converts application actions into a canonical event contract and delivers them to
ThreatFlix, where deterministic rules correlate the telemetry into investigations and optional UEBA,
MITRE ATT&CK mapping, graph similarity, and LLM reporting add context.

The SDK observes and transports. It never decides whether an event is malicious.

```text
Your application
    -> threatflix-sdk
    -> canonical security telemetry
    -> ThreatFlix deterministic investigation engine
    -> UEBA + ATT&CK + incident graph + analyst report
```

## Install

```bash
npm install threatflix-sdk
```

## Quick Start

```typescript
import SecurityAI from "threatflix-sdk";

const threatflix = new SecurityAI({
  apiKey: process.env.THREATFLIX_API_KEY!,
  projectId: "northstar-identity",
  backendUrl: "http://127.0.0.1:8000/api",
  appVersion: "2.4.0",
  hostname: "identity-api-01",
});

await threatflix.auth.failedLogin({
  user: "priya@example.com",
  ip: "203.0.113.10",
  service: "identity",
  metadata: { reason: "invalid_password" },
});
```

ThreatFlix receives a normalized event with the project, event type, timestamp, source identity, service,
and application metadata. Your application remains unaware of rules, anomaly models, and investigations.

## Emit Domain Events

Use `event()` for any security-relevant action in your application:

```typescript
const delivery = await threatflix.event("api_key_created", {
  user: "priya@example.com",
  ip: "203.0.113.10",
  service: "identity",
  sessionId: "session-42",
  severity: "high",
  tags: ["identity", "persistence"],
  metadata: {
    scope: "tenant:export",
    keyType: "service-account",
  },
});

console.log(delivery?.eventIds);
```

Useful event names include:

- `failed_login`, `successful_login`, and `password_reset`
- `mfa_disabled` and `mfa_failure`
- `privilege_change`
- `api_key_created`
- `data_export`
- application-specific canonical event names

## What Gets Sent

Every SDK method produces the same canonical telemetry contract:

```json
{
  "projectId": "northstar-identity",
  "event": "api_key_created",
  "user": "priya@example.com",
  "ip": "203.0.113.10",
  "service": "identity",
  "timestamp": "2026-06-12T14:30:00.000Z",
  "sessionId": "session-42",
  "severity": "high",
  "tags": ["identity", "persistence"],
  "metadata": {
    "appVersion": "2.4.0",
    "hostname": "identity-api-01",
    "scope": "tenant:export"
  }
}
```

## API

### Configuration

```typescript
const threatflix = new SecurityAI({
  apiKey: "required-tenant-api-key",
  projectId: "required-project-id",
  backendUrl: "http://127.0.0.1:8000/api",
  appVersion: "optional-application-version",
  hostname: "optional-host-identifier",
  headers: { "X-Correlation-ID": "optional-custom-header" },
});
```

### Authentication Helpers

```typescript
await threatflix.auth.failedLogin({ user, ip, service, metadata });
await threatflix.auth.successfulLogin({ user, ip, service, metadata });
await threatflix.auth.passwordReset({ user, ip, service, metadata });
```

### Generic Event Delivery

```typescript
await threatflix.event(eventName, {
  user,
  ip,
  service,
  timestamp,
  sessionId,
  severity,
  geoLocation,
  tags,
  metadata,
});
```

### Compatibility Helpers

```typescript
threatflix.log({ message: "API quota exceeded", level: "warning" });
threatflix.report({ title: "Manual report", description: "...", severity: "high" });
threatflix.suspiciousIP("203.0.113.10", { source: "internal-watchlist" });
```

## Delivery Behavior

- Events are sent to `POST {backendUrl}/events`.
- The API key is sent as `Authorization: Bearer <apiKey>`.
- `event()` and authentication helpers return the backend acknowledgement when accepted.
- Delivery failures return `undefined` instead of breaking the host application.
- The SDK performs no threat detection, scoring, or automatic investigation creation.

Fail-safe delivery is intentional: security telemetry should not become a new production outage path.
Applications that require guaranteed delivery should inspect acknowledgements and add their own durable queue.

## What Changed

### `1.1.1` - Package-page documentation

- Rewrote the npm README around the actual ThreatFlix integration workflow.
- Added canonical payload, API, delivery behavior, architecture, and limitation documentation.
- Corrected the public npm package name and installation examples.

### `1.1.0` - Canonical telemetry delivery

- Added `event()` for arbitrary identity and application security actions.
- Added awaitable backend acknowledgements containing accepted event IDs.
- Added `sessionId`, `severity`, geolocation, tags, and custom-header support.
- Added explicit ESM exports and published TypeScript declarations.
- Added canonical event-delivery tests.
- Corrected the documented ThreatFlix API base URL.

Compared with `0.0.1`, version `1.1.0` turns the original authentication-event prototype into a general
application telemetry SDK suitable for feeding ThreatFlix deterministic investigations.

## Scope And Limitations

This SDK is part of the student-built ThreatFlix project. It is useful for demos, experimentation, and
studying explainable identity-threat investigation pipelines. The ThreatFlix backend is not provided as a
hosted commercial service, and this package should not be treated as a replacement for a production
telemetry queue or security platform.

## Development

```bash
npm install
npm test
npm run build
npm pack --dry-run
```

Source, backend, demo environment, and architecture documentation:
[github.com/scienstien/threatFlix](https://github.com/scienstien/threatFlix)
