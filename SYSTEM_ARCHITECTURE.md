# SecurityAI Hackathon - Complete System Architecture

**Project**: AI-powered security copilot SDK  
**Goal**: Ingest security events → Detect threats → Map to MITRE → Display alerts  
**Team**: 4 members, one shared repo, 6-hour deadline  

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Application                     │
│  (Uses SDK to emit security events like failed logins)       │
└────────────────────────┬────────────────────────────────────┘
                         │
                    import SecurityAI
                         │
┌────────────────────────▼────────────────────────────────────┐
│            MEMBER C - JavaScript SDK                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ SecurityAI Class                                     │  │
│  │ - auth.failedLogin()                                │  │
│  │ - auth.successfulLogin()                            │  │
│  │ - log()                                             │  │
│  │ - report()                                          │  │
│  │ - suspiciousIP()                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                     Normalizes events to                    │
│                canonical SecurityEvent format              │
│                                                             │
│  Response: { projectId, event, user, ip, timestamp }       │
└────────────────────────┬────────────────────────────────────┘
                         │
                  POST /events
                  (JSON payload)
                         │
┌────────────────────────▼────────────────────────────────────┐
│            MEMBER A - Backend API                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ REST API Layer (Express/Node)                        │  │
│  │ POST   /events          ← Accept SDK events         │  │
│  │ GET    /alerts          ← Return analyzed threats   │  │
│  │ GET    /events          ← Return raw events         │  │
│  │ POST   /analyze         ← Trigger LLM analysis      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Data Storage (SQLite / In-Memory)                    │  │
│  │ - Events table (projectId, event, user, ip, ts)    │  │
│  │ - Alerts table (attack, severity, mitre, etc)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ AI Analysis Engine                                   │  │
│  │ 1. Get last N events for a project                 │  │
│  │ 2. Build timeline analysis                         │  │
│  │ 3. Send to Gemini LLM with strict JSON format      │  │
│  │ 4. Parse response: attack, severity, confidence    │  │
│  │ 5. Map to MITRE technique                          │  │
│  │ 6. Store alert in database                         │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
              GET /alerts, /events
                  (JSON response)
                         │
┌────────────────────────▼────────────────────────────────────┐
│            MEMBER B - Frontend Dashboard                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ React Component (Tailwind CSS)                       │  │
│  │                                                      │  │
│  │ ┌──────────────────────────────────────────────────┐ │  │
│  │ │ Header: Stats Panel                             │ │  │
│  │ │ - Total Events                                  │ │  │
│  │ │ - Active Threats                                │ │  │
│  │ │ - Critical Alerts                               │ │  │
│  │ └──────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  │ ┌──────────────────────────────────────────────────┐ │  │
│  │ │ Alert Feed (Live)                               │ │  │
│  │ │ ├─ Brute Force [HIGH]                          │ │  │
│  │ │ ├─ Lateral Movement [CRITICAL]                 │ │  │
│  │ │ └─ Privilege Escalation [CRITICAL]             │ │  │
│  │ └──────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  │ ┌──────────────────────────────────────────────────┐ │  │
│  │ │ Alert Details Panel (onClick)                   │ │  │
│  │ │ - Attack Type & Description                     │ │  │
│  │ │ - Severity & Confidence                         │ │  │
│  │ │ - MITRE Technique (T1110, etc)                 │ │  │
│  │ │ - AI Reasoning & Recommendation                │ │  │
│  │ │ - Timeline of Events                           │ │  │
│  │ └──────────────────────────────────────────────────┘ │  │
│  │                                                      │  │
│  │ ┌──────────────────────────────────────────────────┐ │  │
│  │ │ Query Box: "What happened in last hour?"        │ │  │
│  │ └──────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                         ▲
                         │
                   GET requests every 5s
                         │
┌────────────────────────┴────────────────────────────────────┐
│            MEMBER D - Demo Data & MITRE                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MITRE ATT&CK Mapping (mitre-techniques.ts)           │  │
│  │ - T1110: Brute Force                                │  │
│  │ - T1078: Valid Accounts                             │  │
│  │ - T1021: Remote Services (Lateral Movement)         │  │
│  │ - T1548: Privilege Escalation                       │  │
│  │ - T1041: Exfiltration Over C2                       │  │
│  │ - (+ 7 more techniques)                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Attack Scenarios (attack-scenarios.ts)               │  │
│  │ 1. Brute Force (T1110)                             │  │
│  │ 2. Lateral Movement (T1021 + T1041)                │  │
│  │ 3. Privilege Escalation (T1548)                    │  │
│  │ 4. Credential Stuffing (T1110)                     │  │
│  │ 5. Suspicious IP (T1589)                           │  │
│  │                                                     │  │
│  │ Each generates 5-15 events via SDK                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Demo Runner (runner.ts)                              │  │
│  │ - Orchestrates all scenarios                        │  │
│  │ - Timing: ~30 seconds total                         │  │
│  │ - Validates expected outputs                        │  │
│  │ - CLI: npx ts-node runner.ts --all                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## Data Flow Example: Brute Force Attack

### 1. SDK generates events (Member C)
```javascript
const security = new SecurityAI({ apiKey, projectId, backendUrl });
security.auth.failedLogin({ user: 'admin', ip: '10.0.0.99' });
// Repeats 10 times...
security.auth.successfulLogin({ user: 'admin', ip: '10.0.0.99' });
```

### 2. Events normalized to canonical format
```json
{
  "projectId": "demo-project",
  "event": "failed_login",
  "user": "admin",
  "ip": "10.0.0.99",
  "timestamp": "2026-05-30T10:00:00Z",
  "metadata": { "reason": "invalid_password" }
}
```

### 3. Backend receives via POST /events (Member A)
```
POST /events
Content-Type: application/json
Authorization: Bearer demo-api-key-12345

{ ...event... }
```

### 4. Backend stores and updates timeline
```
Events collection:
- 2026-05-30T10:00:00Z: failed_login (admin, 10.0.0.99)
- 2026-05-30T10:00:03Z: failed_login (admin, 10.0.0.99)
- ... (8 more)
- 2026-05-30T10:00:30Z: successful_login (admin, 10.0.0.99) ← BINGO!
```

### 5. Backend AI analysis (Member A)
```
Prompt to Gemini:
"Given this timeline of events, identify the attack type, severity, 
confidence, MITRE technique, reasoning, and recommendation."

Response:
{
  "attack": "Brute Force",
  "severity": "High",
  "confidence": 0.95,
  "mitre": "T1110",
  "reasoning": "Multiple rapid failed logins followed by success...",
  "recommendation": "Reset credentials, enable MFA, block IP..."
}
```

### 6. Alert stored and exposed via GET /alerts (Member A)
```
GET /alerts?projectId=demo-project
Response:
[
  {
    "id": "alert-123",
    "attack": "Brute Force",
    "severity": "High",
    "confidence": 0.95,
    "mitre": "T1110",
    "timestamp": "2026-05-30T10:00:31Z",
    "eventCount": 11
  }
]
```

### 7. Frontend fetches and displays (Member B)
```
GET /alerts → Alerts component renders:

┌─────────────────────────────────────┐
│ 🚨 Brute Force                      │
│ Severity: High | Confidence: 95%    │
│ MITRE: T1110                        │
│ Events: 11 | Time: 30 seconds       │
└─────────────────────────────────────┘

[Click] → Shows:
"Multiple rapid failed logins followed by success 
from IP 10.0.0.99 targeting admin account..."
```

---

## API Contract (Lock this first!)

### Common Response Format

**Error Response** (4xx/5xx):
```json
{
  "error": "Invalid projectId",
  "code": "INVALID_REQUEST"
}
```

### POST /events
**Request**:
```json
{
  "projectId": "string",
  "event": "failed_login|successful_login|log|report|suspicious_ip",
  "user": "string (optional)",
  "ip": "string (optional)",
  "service": "string (optional)",
  "timestamp": "ISO8601",
  "metadata": {}
}
```

**Response**: `{ "status": "accepted" }` or `{ "error": "..." }`

### GET /events
**Query**: `?projectId=...&limit=50&offset=0`

**Response**:
```json
{
  "events": [
    {
      "id": "evt-123",
      "projectId": "proj-1",
      "event": "failed_login",
      "user": "admin",
      "ip": "10.0.0.99",
      "timestamp": "2026-05-30T10:00:00Z",
      "metadata": {}
    }
  ],
  "total": 1234
}
```

### GET /alerts
**Query**: `?projectId=...&limit=50`

**Response**:
```json
{
  "alerts": [
    {
      "id": "alert-123",
      "projectId": "proj-1",
      "attack": "Brute Force",
      "severity": "High",
      "confidence": 0.95,
      "mitre": "T1110",
      "reasoning": "...",
      "recommendation": "...",
      "eventCount": 11,
      "timestamp": "2026-05-30T10:00:31Z"
    }
  ]
}
```

### POST /analyze (optional)
**Request**: `{ "projectId": "...", "timewindow_minutes": 5 }`

**Response**: Same as alert in `/alerts`

---

## Team Responsibilities

| Member | Component | Key Tasks |
|--------|-----------|-----------|
| **A** | Backend API + AI | Event storage, LLM integration, MITRE mapping, endpoints |
| **B** | Frontend Dashboard | Alert feed, detail panel, real-time updates, styling |
| **C** | JavaScript SDK | Event normalization, client metadata, HTTP posting |
| **D** | Demo + MITRE | Attack scenarios, demo runner, MITRE database, narrative |

---

## Integration Checklist

### Phase 1: Architecture Lock (0:00-0:30)
- [ ] SDK exports defined (Member C)
- [ ] API contract finalized (Member A → All)
- [ ] Demo scenarios planned (Member D)
- [ ] Dashboard mockup (Member B)

### Phase 2: Parallel Build (0:30-2:30)
- [ ] SDK functional and tested (Member C)
- [ ] Backend /events and /alerts endpoints (Member A)
- [ ] Frontend skeleton with mock data (Member B)
- [ ] MITRE mapping and attack scenarios (Member D)

### Phase 3: Integration (2:30-4:30)
- [ ] SDK → Backend connection works
- [ ] Backend → Dashboard API working
- [ ] Demo scenarios generate realistic alerts
- [ ] Dashboard displays alerts in real-time

### Phase 4: Polish & Demo (4:30-6:00)
- [ ] UI refinements
- [ ] Error handling
- [ ] Demo script rehearsal (run 3 times without breaking)
- [ ] Fallback plan ready

---

## Deployment

### Local Demo Setup

```bash
# Terminal 1: Backend
cd threatFlix/Backend
npm install
npm run dev  # Starts on http://localhost:3000

# Terminal 2: Frontend
cd threatFlix/FrontEnd
npm install
npm run dev  # Starts on http://localhost:5173

# Terminal 3: Run Demo
cd threatFlix/Demo
npm install
npx ts-node runner.ts --all
```

### Viewing Live Demo

1. Open http://localhost:5173 in browser
2. Run demo in Terminal 3
3. Watch alerts populate in real-time

---

## File Structure

```
threatFlix/
├── SDK/                      (Member C)
│   ├── src/
│   │   ├── index.ts         (Main class)
│   │   └── types.ts         (API contract)
│   ├── dist/                (Compiled)
│   ├── examples/
│   │   └── example-brute-force-demo.ts
│   └── package.json
│
├── Backend/                  (Member A)
│   ├── src/
│   │   ├── api.ts           (Express app)
│   │   ├── ai-engine.ts     (LLM integration)
│   │   └── db.ts            (SQLite)
│   └── package.json
│
├── FrontEnd/                 (Member B)
│   ├── src/
│   │   ├── index.tsx        (Main)
│   │   ├── components/
│   │   │   ├── AlertFeed.tsx
│   │   │   ├── AlertDetail.tsx
│   │   │   └── StatsPanel.tsx
│   │   └── api/
│   │       └── client.ts    (Backend calls)
│   └── package.json
│
├── Demo/                     (Member D)
│   ├── mitre-techniques.ts
│   ├── attack-scenarios.ts
│   ├── runner.ts
│   ├── README.md
│   └── package.json
│
└── README.md                 (This file)
```

---

## Communication Protocol

**Blocker Channel**: One Slack/Discord channel  
**Updates**: Every 45 minutes on status  
**API Changes**: Announce before implementing  
**Merging**: One person owns final integration (designate!)  

---

## Success Criteria

✅ SDK captures and sends events  
✅ Backend analyzes with LLM  
✅ Dashboard displays alerts in real-time  
✅ MITRE techniques correctly mapped  
✅ Demo runs without breaking  
✅ Product demo is polished  
✅ Code merges cleanly  

---

**Remember**: Pretty nonsense without a working loop is just decorative failure. 
Build the minimum path from SDK → alert card first. Only then polish.

Let's build! 🚀
