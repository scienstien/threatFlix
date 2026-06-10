# ThreatFlix Frontend

**Version 1.0.0**

React 19 + Vite analyst interface for ThreatFlix investigations.

## V1 Experience

- Investigation queue and workspace
- Raw telemetry timeline
- Deterministic evidence and attack-chain presentation
- Animated incident node graph
- Cross-incident graph similarity results
- UEBA score and human-readable feature deviations
- Structured interpretation report
- Compact SOC chat drawer
- Preserved login, signup, JWT, API-key, and integration flows

The interface intentionally prioritizes raw telemetry and deterministic evidence. ML and LLM output are
supporting context rather than the visual authority.

## Run

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/dashboard`. The backend is expected at `http://127.0.0.1:8000`.

## Build

```powershell
npm run build
```
