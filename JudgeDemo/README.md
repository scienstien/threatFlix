# ThreatFlix Manual Judge Demo

The strongest demo story is manual:

1. Show that Northstar is not connected.
2. Add the ThreatFlix SDK initialization in a few lines.
3. Generate a real tenant-scoped API key in ThreatFlix.
4. Paste the key into Northstar and show it become connected.
5. Run attack traffic only against Northstar.
6. Open the investigations produced by ThreatFlix.

## Start the demo

```powershell
cd JudgeDemo
.\start_demo.ps1
```

Open:

- Northstar: `http://127.0.0.1:4100`
- ThreatFlix integration: `http://127.0.0.1:5173/integration`
- ThreatFlix case desk: `http://127.0.0.1:5173/dashboard`

ThreatFlix login:

- Email: `judge.demo@threatflix.local`
- Password: `JudgeDemo!2026`

## Scene 1: integrate Northstar

Open `JudgeDemo/threatflix.ts`. The generated tenant starts without an API key.
Type or explain this initialization block:

```typescript
import SecurityAI from "../SDK/src/index.ts";

export const THREATFLIX_API_KEY = "PASTE_GENERATED_KEY_HERE";

export const threatflix = new SecurityAI({
  apiKey: THREATFLIX_API_KEY,
  projectId: "judge-demo-northstar",
  backendUrl: "http://127.0.0.1:8000/api",
});
```

Then open ThreatFlix `/integration`, generate a key called
`Northstar identity service`, and replace `PASTE_GENERATED_KEY_HERE`. Saving the
file restarts Northstar automatically. Its SDK panel changes from `Awaiting key`
to `Ready to send`. When ThreatFlix accepts the first event, it changes to
`Connected / Healthy`.

## Scene 2: show instrumentation

In `JudgeDemo/server.ts`, show the call inside `emit()`:

```typescript
const delivery = await threatflix.event(event, {
  user: details.user,
  ip: details.ip,
  service: "northstar-identity",
  sessionId: details.sessionId,
  severity: details.severity,
  metadata: details.metadata,
});
```

The important point: Northstar emits domain telemetry. It contains no attack
detection logic and cannot create investigations.

## Scene 3: attack and investigate

```powershell
python attack_runner.py --scenario all --delay 0.25
```

The Python runner calls only Northstar endpoints. ThreatFlix receives the SDK
telemetry and creates investigations for brute force, password spray,
credential stuffing, privilege/persistence abuse, and data exfiltration.

`start_demo.ps1` starts the trained ML sidecar automatically. It deliberately
does not start Ollama because local models consume substantial RAM. Start Ollama
separately when the recording should include freshly generated interpretation
reports; the backend uses `gemma3n:e2b`.
