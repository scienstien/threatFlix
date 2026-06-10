# ThreatFlix Legacy Demo Runner

**Version 1.0.0**

This package contains the original standalone SDK-driven attack scenarios. It remains useful for event
ingestion demonstrations and regression checks.

For the complete V1 product demo, prefer the reproducible backend seed:

```powershell
cd ../Backend
npm run seed:demo
```

## Run Legacy Scenarios

```powershell
npm install
npm run demo
npm run demo:brute-force
npm run demo:lateral
npm run demo:escalation
npm run demo:stuffing
npm run demo:suspicious
```

The scenarios send canonical events through the SDK to the configured ThreatFlix backend.
