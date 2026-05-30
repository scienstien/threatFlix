# Team D - Demo Data & MITRE Support

**Owner**: Team D  
**Status**: Ready for integration with Team A (Backend) and Team B (Frontend)

## Overview

Team D provides the demo infrastructure that **makes the product look impressive**. This folder contains:

1. **Attack Scenarios** - 5 realistic security threats
2. **MITRE Mapping** - Technique database for threat classification
3. **Demo Runner** - Orchestrator that generates events
4. **Expected Outputs** - What alerts should look like

## Files

### `mitre-techniques.ts`
MITRE ATT&CK technique database with 12+ common techniques relevant to the hackathon demo.

**Used by**:
- Team A (Backend) - classify detected attacks
- Team B (Frontend) - display technique IDs and descriptions

**Key exports**:
```typescript
getTechnique(id: string): MitreTechnique
getTechniquesByTactic(tactic: string): MitreTechnique[]
inferMitreTechnique(attackType: string): MitreTechnique
```

### `attack-scenarios.ts`
5 realistic attack sequences that generate events via the SecurityAI SDK.

**Scenarios**:
1. **Brute Force** (T1110) - 10 failed logins → success
2. **Lateral Movement** (T1021) - Valid account from unusual location + bulk export
3. **Privilege Escalation** (T1548) - Low-privilege user gains root
4. **Credential Stuffing** (T1110) - 15 rapid attempts across usernames
5. **Suspicious IP** (T1589) - Malicious IP reconnaissance

Each scenario:
- Takes 3-5 seconds to run
- Generates 5-15 events
- Includes metadata for AI analysis
- Has a corresponding expected alert output

### `runner.ts`
Main demo orchestrator. Runs scenarios and manages timing.

**Usage**:
```bash
# Run all scenarios
bun run runner.ts --all

# Run specific scenario
bun run runner.ts --scenario brute-force

# Custom backend URL
bun run runner.ts --backend http://api.example.com --all

# Quiet mode (for demo videos)
bun run runner.ts --all --quiet
```

**Expected Outputs** embedded in code - use for validating Team A's backend analysis.

## Integration Points

### With Team A (Backend)

Team A will:
1. Receive events from SDK via `POST /events`
2. Analyze events using LLM and MITRE mapping
3. Return structured JSON alert (see `EXPECTED_OUTPUTS`)

**Team D → Team A**:
- Demo sends events using canonicalized SDK payload
- Team A runs LLM analysis
- Team D can validate output matches `EXPECTED_OUTPUTS`

### With Team B (Frontend)

Team B will:
1. Fetch alerts from Team A via `GET /alerts`
2. Display threat severity, confidence, MITRE technique
3. Show alert details panel

**Team D → Team B**:
- Demo data shows what alerts should look like
- Frontend can be styled against these examples
- Demo events become live demo flow

## Quick Start

### 1. Setup Backend Connection

Ensure Team A has backend running:
```
Backend listening on http://localhost:3000
POST /events accepting SDK events
```

### 2. Run Demo

```bash
cd Demo
bun run runner.ts --all
```

You should see:
```
🚨 SCENARIO 1: BRUTE FORCE ATTACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [1/10] Failed login attempt...
  [2/10] Failed login attempt...
  ...
  [SUCCESS] Successful login: admin@10.0.0.99

✓ Events sent to backend
```

### 3. Check Dashboard

Open Team B's frontend dashboard to see real-time alerts appearing as scenarios run.

## Live Demo Script (5-6 min)

```
1. [0:00] Open SDK code, show simple integration
2. [0:30] Show dashboard (empty, waiting for events)
3. [1:00] Run demo: npx ts-node runner.ts --all
4. [1:30] Point to alert feed filling up in real-time
5. [2:00] Click first alert (Brute Force)
6. [2:30] Show alert details: severity, confidence, MITRE T1110, reasoning
7. [3:00] Click second alert (Lateral Movement)
8. [3:30] Explain the threat narrative
9. [4:00] Show MITRE mapping in dashboard
10. [4:30] Recap: "SDK → Backend Analysis → Dashboard"
11. [5:00] End
```

## Data Flow

```
Demo Runner (runner.ts)
    ↓
Attack Scenarios (attack-scenarios.ts)
    ↓
SecurityAI SDK (../SDK)
    ↓
Backend POST /events (Team A)
    ↓
AI Analysis + MITRE Mapping
    ↓
Dashboard GET /alerts (Team B)
    ↓
Live Alert Feed + Details
```

## Expected Alert Outputs

See `runner.ts` → `EXPECTED_OUTPUTS` for exact JSON structures that Team A's backend should produce.

Example:
```json
{
  "attack": "Brute Force Attack",
  "severity": "High",
  "confidence": 0.95,
  "mitre": "T1110",
  "reasoning": "10 rapid failed login attempts from single IP...",
  "recommendation": "Immediately reset admin password..."
}
```

## Checklist for Hackathon

- [ ] Backend running and accepting `/events`
- [ ] Demo runner can connect and send events
- [ ] Alerts appearing in backend analysis
- [ ] Dashboard pulling live alerts
- [ ] MITRE techniques displaying correctly
- [ ] Live demo runs without breaking (3 times)
- [ ] Fallback: Have pre-recorded screenshots ready

## Tips for Success

1. **Timing**: Each scenario takes 3-5s. Total = 30s for all 5.
2. **Internet Lag**: If backend is remote, add `--delay 3000` for more spacing.
3. **Visual Feedback**: Run dashboard in split screen while demo runs.
4. **Fallback Plan**: Screenshots of expected outputs (in `EXPECTED_OUTPUTS`).
5. **Narrative**: Don't just run demo—explain what you're looking at.

## Files Reference

- **MITRE Data**: `mitre-techniques.ts` (12 techniques, ~200 lines)
- **Attack Logic**: `attack-scenarios.ts` (5 scenarios, ~400 lines)
- **Runner**: `runner.ts` (orchestration + expected outputs, ~300 lines)
- **This Doc**: `README.md` (you are here)

---

**Team D is responsible for**: Making the product look amazing in 6 minutes.
