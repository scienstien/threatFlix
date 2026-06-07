<p align="center">
  <img src="https://img.shields.io/badge/🛡️_ThreatFlix-AI_Security_Copilot-ff4444?style=for-the-badge&labelColor=1a1a2e" alt="ThreatFlix" />
</p>

<h1 align="center">ThreatFlix</h1>
<h3 align="center">🛡️ AI-Powered Security Copilot SDK — Detect. Analyze. Respond.</h3>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?style=flat-square&logo=bun" alt="Bun" />
  <img src="https://img.shields.io/badge/AI-Google_Gemini-4285F4?style=flat-square&logo=google" alt="Gemini" />
  <img src="https://img.shields.io/badge/framework-MITRE_ATT%26CK-e63946?style=flat-square" alt="MITRE" />
  <img src="https://img.shields.io/badge/frontend-React_19-61dafb?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/database-SQLite-003B57?style=flat-square&logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
</p>

<p align="center">
  <b>ThreatFlix</b> is an end-to-end AI-powered security platform that ingests real-time security events from your application, detects active threats using Google Gemini, maps them to the <a href="https://attack.mitre.org/">MITRE ATT&CK</a> framework, and surfaces actionable alerts on a live dashboard — all in under 2 seconds.
</p>

<br />

---

## 📑 Table of Contents

- [Why ThreatFlix?](#-why-threatflix)
- [How It Works](#-how-it-works)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [The SDK (`@securityai/sdk`)](#-the-sdk-securityaisdk)
- [The Backend](#-the-backend)
- [The Dashboard (Frontend)](#-the-dashboard-frontend)
- [The Demo Runner](#-the-demo-runner)
- [API Reference](#-api-reference)
- [Environment Variables](#-environment-variables)
- [MITRE ATT&CK Mapping](#-mitre-attck-mapping)
- [Webhook Integrations](#-webhook-integrations)
- [Security & Authentication](#-security--authentication)
- [Tech Stack](#-tech-stack)
- [Contributing](#-contributing)
- [License](#-license)

---

## 💡 Why ThreatFlix?

Most security tools are **reactive** — they alert you after the damage is done. ThreatFlix flips the script:

| Traditional Security Logging | ThreatFlix |
|---|---|
| ❌ Raw log files nobody reads | ✅ AI-analyzed threat intelligence |
| ❌ Manual SIEM rule writing | ✅ LLM-powered pattern detection |
| ❌ No context on what happened | ✅ Full attack narrative with reasoning |
| ❌ Separate dashboard setup | ✅ Beautiful real-time alert dashboard |
| ❌ Complex integration | ✅ 3-line SDK integration |

**One SDK call. AI does the rest.**

```typescript
// That's it. ThreatFlix handles detection, analysis, and alerting.
security.auth.failedLogin({ user: 'admin', ip: '10.0.0.99' });
```

---

## ⚡ How It Works

ThreatFlix operates as a closed-loop detection pipeline in **four stages**:

```
  ╔══════════════════╗      ╔══════════════════╗      ╔══════════════════╗      ╔══════════════════╗
  ║   1. CAPTURE     ║      ║   2. INGEST      ║      ║   3. ANALYZE     ║      ║   4. ALERT       ║
  ║                  ║      ║                  ║      ║  Our specialised ║      ║                  ║
  ║  Your app uses   ║─────▶║  Backend stores ║─────▶║   AI             ║────▶║  Dashboard shows ║
  ║  the SDK to emit ║      ║  events in SQLite║      ║ detects attacks  ║      ║  live alerts     ║
  ║  security events ║      ║  and builds a    ║      ║  and maps to     ║      ║  with MITRE      ║
  ║                  ║      ║  timeline        ║      ║  MITRE ATT&CK    ║      ║  context         ║
  ╚══════════════════╝      ╚══════════════════╝      ╚══════════════════╝      ╚══════════════════╝
```

### A Real Example: Brute Force Detection

<details>
<summary><b>🔍 Click to see the full detection flow</b></summary>

<br />

**Step 1 — Your app captures failed logins via the SDK:**
```typescript
const security = new SecurityAI({
  apiKey: 'your-api-key',
  projectId: 'my-app',
  backendUrl: 'http://localhost:8000'
});

// Attacker tries 10 passwords
for (let i = 0; i < 10; i++) {
  security.auth.failedLogin({
    user: 'admin',
    ip: '10.0.0.99',
    metadata: { attemptNumber: i + 1, reason: 'invalid_password' }
  });
}

// Then succeeds — credential compromised!
security.auth.successfulLogin({ user: 'admin', ip: '10.0.0.99' });
```

**Step 2 — Backend receives and stores each event via `POST /events`:**
```
2026-06-01T10:00:00Z  failed_login     admin  10.0.0.99
2026-06-01T10:00:03Z  failed_login     admin  10.0.0.99
2026-06-01T10:00:06Z  failed_login     admin  10.0.0.99
   ... (7 more failed attempts) ...
2026-06-01T10:00:30Z  successful_login admin  10.0.0.99   ← BINGO!
```

**Step 3 — AI analyzes the timeline and produces a threat assessment:**
```json
{
  "attack": "Brute Force",
  "severity": "High",
  "confidence": 0.95,
  "mitre": "T1110",
  "mitreName": "Brute Force",
  "reasoning": "10 rapid failed login attempts from IP 10.0.0.99 targeting the admin account, followed by a successful login. This pattern is consistent with password guessing.",
  "recommendation": "Immediately reset admin credentials, enable MFA, block IP 10.0.0.99, and review all admin activity from the last 24 hours."
}
```

**Step 4 — The dashboard renders a live alert card:**
```
┌──────────────────────────────────────────────────┐
│  🚨 Brute Force                                  │
│  Severity: High  │  Confidence: 95%              │
│  MITRE: T1110 — Brute Force                      │
│  Events: 11  │  Time Window: 30 seconds           │
│                                                    │
│  "10 rapid failed logins from 10.0.0.99           │
│   followed by success on admin account..."         │
│                                                    │
│  [View Details]              [✓ Resolve]           │
└──────────────────────────────────────────────────┘
```

</details>

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       YOUR APPLICATION                              │
│   (Express, Next.js, Fastify, Bun — any JS/TS backend or frontend) │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                          import SDK
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                         SDK (@securityai/sdk)                        │
│                                                                      │
│   security.auth.failedLogin()     security.log()                     │
│   security.auth.successfulLogin() security.report()                  │
│   security.auth.passwordReset()   security.suspiciousIP()            │
│                                                                      │
│   ► Normalizes every call into a canonical SecurityEvent payload     │
│   ► Attaches metadata (timestamp, hostname, app version)             │
│   ► Sends via HTTP POST with API key in Authorization header         │
│   ► Never throws — fails silently to protect your app                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                     POST /events (JSON)
                     Authorization: Bearer <api-key>
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                          BACKEND (Bun + SQLite)                      │
│                                                                      │
│   ┌──────────────┐   ┌──────────────┐   ┌─────────────────────┐    │
│   │  REST API    │   │  SQLite DB   │   │  AI Analysis Engine │    │
│   │              │   │              │   │                     │    │
│   │  POST /events│──▶│  Events      │──▶│  Google Gemini LLM  │    │
│   │  GET  /alerts│◀──│  Alerts      │◀──│  + Fallback Rules   │    │
│   │  POST /analyze│  │  API Keys    │   │  + MITRE Enrichment │    │
│   │  CRUD webhooks│  │  Webhooks    │   │  + Auto-batching    │    │
│   │  Auth (JWT)  │   │  Users       │   │  + Retry w/ backoff │    │
│   └──────────────┘   └──────────────┘   └─────────────────────┘    │
│                                                                      │
│   ► Rate limiting (per-IP & per-project)                             │
│   ► CORS middleware                                                  │
│   ► API key auth (SDK) + JWT auth (Dashboard)                        │
│   ► Webhook delivery with HMAC signatures                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                    GET /alerts, GET /events
                    Authorization: Bearer <jwt>
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                     FRONTEND DASHBOARD (React 19 + Vite)             │
│                                                                      │
│   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐       │
│   │  Stat Cards    │  │  Alert Feed    │  │  Event Feed    │       │
│   │  Total Events  │  │  Live threats  │  │  Raw event log │       │
│   │  Active Threats│  │  MITRE mapping │  │  With metadata │       │
│   │  Critical Count│  │  AI reasoning  │  │  Real-time     │       │
│   └────────────────┘  └────────────────┘  └────────────────┘       │
│                                                                      │
│   ┌────────────────┐  ┌────────────────┐                            │
│   │  Alert Detail  │  │  Integration   │                            │
│   │  Full analysis │  │  API keys      │                            │
│   │  Recommendations│ │  Webhooks      │                            │
│   │  Event timeline│  │  SDK snippets  │                            │
│   └────────────────┘  └────────────────┘                            │
│                                                                      │
│   ► GSAP animations  ► Recharts visualizations  ► TailwindCSS       │
│   ► JWT-authenticated ► Admin panel  ► OAuth-ready                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+) — JavaScript runtime & package manager
- [Google Gemini API Key](https://aistudio.google.com/apikey) — for AI threat analysis (optional; falls back to rule-based detection)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/threatFlix.git
cd threatFlix
```

### 2. Configure the Backend

```bash
cd Backend
bun install

# Create your environment file
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Required for AI-powered analysis (optional — rule-based fallback works without it)
GEMINI_API_KEY=your-gemini-api-key-here

# Server
PORT=8000

# Database (auto-created)
DATABASE_PATH=./data/threatflix.db

# Admin credentials for the dashboard
ADMIN_EMAIL=admin@threatflix.dev
ADMIN_PASSWORD=admin123
```

### 3. Start the Backend

```bash
bun run dev
```

You should see:

```
🛡️  ThreatFlix SecurityAI Backend
─────────────────────────────────────────────
  Environment : development
  Port        : 8000
  Database    : ./data/threatflix.db
  AI Provider : Google Gemini
─────────────────────────────────────────────
  ✅ Database initialized

🚀 Server running at http://localhost:8000
```

### 4. Start the Dashboard

```bash
# In a new terminal
cd FrontEnd
bun install
bun run dev
```

Open **http://localhost:5173** in your browser.

### 5. Run the Demo

```bash
# In a third terminal
cd Demo
bun install
bun run demo
```

This fires 5 realistic attack scenarios through the SDK → Backend → Dashboard pipeline. Watch the alerts populate in real-time on the dashboard! 🎬

---

## 📂 Project Structure

```
threatFlix/
│
├── SDK/                          # 📦 npm package — @securityai/sdk
│   ├── src/
│   │   ├── index.ts              # SecurityAI main class
│   │   └── types.ts              # TypeScript interfaces (API contract)
│   ├── examples/
│   │   ├── example-auth.ts       # Basic auth event examples
│   │   ├── example-brute-force-demo.ts  # Attack simulation
│   │   └── example-generic-events.ts    # Custom events
│   ├── INTEGRATION_GUIDE.md      # SDK integration documentation
│   ├── README.md                 # SDK-specific readme
│   └── package.json
│
├── Backend/                      # 🖥️ API server — Bun + SQLite
│   ├── src/
│   │   ├── server.ts             # Bun.serve() entry point & router
│   │   ├── config.ts             # Centralized env-based config
│   │   ├── ai/
│   │   │   ├── analyzer.ts       # AI analysis engine (Gemini + fallback)
│   │   │   ├── prompts.ts        # LLM prompt templates (versioned)
│   │   │   └── mitre.ts          # MITRE ATT&CK technique dictionary
│   │   ├── db/
│   │   │   ├── database.ts       # SQLite setup, migrations, seeding
│   │   │   └── repositories/     # Data access layer
│   │   │       ├── eventRepository.ts
│   │   │       └── alertRepository.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts           # API key + JWT authentication
│   │   │   ├── cors.ts           # CORS handling
│   │   │   ├── rateLimit.ts      # Per-IP & per-project rate limiting
│   │   │   └── validation.ts     # Request payload validation
│   │   ├── routes/
│   │   │   ├── events.ts         # POST /events, GET /events/latest
│   │   │   ├── alerts.ts         # GET /alerts, GET /alerts/:id, PATCH
│   │   │   ├── analyze.ts        # POST /analyze
│   │   │   ├── webhookRoutes.ts  # CRUD /webhooks
│   │   │   ├── apiKeysRoutes.ts  # CRUD /apikeys
│   │   │   ├── admin.ts          # GET /admin/stats, /admin/projects
│   │   │   └── health.ts         # GET /health
│   │   ├── webhooks/
│   │   │   └── emitter.ts        # Webhook delivery with HMAC signing
│   │   ├── types/
│   │   │   ├── events.ts         # Event type definitions
│   │   │   └── alerts.ts         # Alert type definitions
│   │   └── seed.ts               # Database seed script
│   ├── .env.example
│   └── package.json
│
├── FrontEnd/                     # 🎨 React dashboard — Vite + TailwindCSS
│   ├── src/
│   │   ├── App.tsx               # Router (Login, Dashboard, Admin)
│   │   ├── frontend.tsx          # React DOM entry
│   │   ├── index.css             # Global styles & design tokens
│   │   ├── api/
│   │   │   └── client.ts         # Backend API client
│   │   ├── context/
│   │   │   └── AuthContext.tsx    # Auth state provider
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx     # Login + OAuth
│   │   │   ├── DashboardPage.tsx # Main threat dashboard
│   │   │   ├── AdminPage.tsx     # Admin controls
│   │   │   └── OAuthCallbackPage.tsx
│   │   └── components/
│   │       ├── dashboard/
│   │       │   ├── StatCards.tsx        # KPI stat cards
│   │       │   ├── AlertCard.tsx        # Individual alert card
│   │       │   ├── AlertDetailPanel.tsx # Full alert detail overlay
│   │       │   ├── EventFeed.tsx        # Real-time event feed
│   │       │   └── IntegrationPanel.tsx # API keys + webhook config
│   │       ├── charts/                  # Recharts visualizations
│   │       ├── layout/                  # App shell & navigation
│   │       ├── admin/                   # Admin-specific components
│   │       └── ui/                      # Shared UI primitives
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── Demo/                         # 🎬 Attack scenario simulator
│   ├── runner.ts                 # CLI orchestrator
│   ├── attack-scenarios.ts       # 5 realistic attack patterns
│   ├── mitre-techniques.ts       # MITRE ATT&CK reference database
│   ├── README.md                 # Demo-specific documentation
│   └── package.json
│
├── SYSTEM_ARCHITECTURE.md        # Detailed system architecture doc
└── README.md                     # ← You are here
```

---

## 📦 The SDK (`@securityai/sdk`)

The SDK is a **zero-dependency, ~2KB** TypeScript library that you install in your application to capture security events.

### Installation

```bash
npm install @securityai/sdk
```

### Initialize

```typescript
import SecurityAI from '@securityai/sdk';

const security = new SecurityAI({
  apiKey: 'your-api-key',       // Required — authenticates with the backend
  projectId: 'my-app',          // Required — identifies your project
  backendUrl: 'http://localhost:8000',  // Optional (default: http://localhost:3000)
  appVersion: '2.1.0',          // Optional — attached to event metadata
  hostname: 'prod-server-01',   // Optional — attached to event metadata
});
```

### Capture Events

<details>
<summary><b>🔐 Authentication Events</b></summary>

```typescript
// Failed login — the bread and butter of brute force detection
security.auth.failedLogin({
  user: 'admin',
  ip: '192.168.1.5',
  service: 'auth-service',
  metadata: { attemptNumber: 3, reason: 'invalid_password' }
});

// Successful login — especially important after failed attempts
security.auth.successfulLogin({
  user: 'admin',
  ip: '192.168.1.5',
  metadata: { method: 'password', mfaUsed: true }
});

// Password reset
security.auth.passwordReset({
  user: 'jane_smith',
  ip: '10.0.0.5'
});
```
</details>

<details>
<summary><b>📝 Generic Logs</b></summary>

```typescript
security.log({
  message: 'API rate limit exceeded',
  level: 'warning',    // 'info' | 'warning' | 'error'
  metadata: { endpoint: '/api/data', requestCount: 1500, limit: 1000 }
});
```
</details>

<details>
<summary><b>🚨 Security Reports</b></summary>

```typescript
security.report({
  title: 'Privilege Escalation Detected',
  description: 'Low-privilege user escalated to root via sudo vulnerability',
  severity: 'critical',    // 'low' | 'medium' | 'high' | 'critical'
  metadata: { userId: 'contractor', newRole: 'root', method: 'sudo_exploit' }
});
```
</details>

<details>
<summary><b>🌐 Suspicious IP Flagging</b></summary>

```typescript
security.suspiciousIP('203.0.113.99', {
  reason: 'blacklist_match',
  geoIP_country: 'KP',
  reputationScore: 0.05,
  requestCount: 500
});
```
</details>

### Event Payload Format

Every SDK method normalizes data into this canonical format before sending:

```json
{
  "projectId": "my-app",
  "event": "failed_login",
  "user": "admin",
  "ip": "192.168.1.5",
  "service": "auth-service",
  "timestamp": "2026-06-01T10:00:00.000Z",
  "metadata": {
    "appVersion": "2.1.0",
    "hostname": "prod-server-01",
    "userAgent": "Mozilla/5.0...",
    "attemptNumber": 3
  }
}
```

### Design Principles

| Principle | Description |
|---|---|
| **Thin client** | No local analysis, caching, or storage — just format and forward |
| **Fail-safe** | Never throws exceptions. Logs warnings to console if backend is unreachable |
| **Zero dependencies** | Only uses native `fetch` / `XMLHttpRequest` |
| **Type-safe** | Full TypeScript interfaces with exported types |
| **Universal** | Works in Node.js, Bun, Deno, and browsers |

---

## 🖥 The Backend

The backend is a **Bun-native HTTP server** with SQLite storage, Google Gemini AI integration, and a full REST API.

### Key Capabilities

- **Event Ingestion** — Receives, validates, and stores security events from the SDK
- **AI Analysis Engine** — Sends event timelines to Google Gemini for threat detection with structured JSON output
- **Rule-based Fallback** — If Gemini is unavailable, a built-in heuristic engine detects common patterns (brute force, credential stuffing, privilege escalation)
- **MITRE ATT&CK Enrichment** — Validates and enriches technique IDs returned by the LLM against a local lookup dictionary of 23+ techniques
- **Automatic Analysis Triggering** — Auto-analyzes when event thresholds are reached per project
- **Webhook Delivery** — Sends alert payloads to configured URLs (n8n, Zapier, Slack) with HMAC signatures
- **Dual Auth** — API key auth for SDK ingestion, JWT auth for dashboard access
- **Rate Limiting** — Per-IP and per-project limits to prevent abuse
- **Migration System** — Versioned SQL migrations with automatic application on startup

### AI Analysis Pipeline

```
Events arrive via POST /events
         │
         ▼
Threshold check: ≥ 5 events in the last 2 minutes?
         │ yes
         ▼
Rate limit check: can this project run analysis?
         │ yes
         ▼
Build event timeline (sorted chronologically)
         │
         ▼
┌─────────────────────────────────────┐
│  Send to Google Gemini              │
│                                     │
│  System Prompt: "You are a          │
│  cybersecurity analyst AI..."       │
│                                     │
│  User Prompt: timeline of events    │
│                                     │
│  Output: structured JSON with       │
│  attack, severity, confidence,      │
│  MITRE ID, reasoning, actions       │
│                                     │
│  Config: temp=0.2, JSON mode        │
│  Retries: 3x with exponential       │
│           backoff (1s, 2s, 4s)      │
└──────────┬──────────────────────────┘
           │ failure?
           ▼
    Fallback to rule-based engine
           │
           ▼
Enrich MITRE technique (validate ID, add URL)
           │
           ▼
Store alert in SQLite
           │
           ▼
Emit webhooks (async, non-blocking)
           │
           ▼
Alert appears on dashboard via GET /alerts
```

---

## 🎨 The Dashboard (Frontend)

A **React 19** single-page application built with Vite, TailwindCSS, GSAP animations, and Recharts.

### Pages

| Page | Route | Description |
|---|---|---|
| **Login** | `/login` | Email/password + OAuth login |
| **Dashboard** | `/dashboard` | Main threat monitoring center |
| **Admin** | `/admin` | Platform-wide stats & management |

### Dashboard Features

- **Stat Cards** — Total events, active threats, and critical alert count at a glance
- **Threat Alert Center** — Live grid of alert cards with severity badges, confidence scores, and MITRE technique tags
- **Alert Detail Panel** — Slide-out overlay with full AI reasoning, recommendations, and the related event timeline
- **Event Feed** — Real-time scrolling feed of raw events as they arrive
- **Integration Panel** — Manage API keys and configure webhook endpoints directly from the UI
- **Animations** — GSAP-powered entrance animations, staggered card reveals, and smooth resolve transitions

---

## 🎬 The Demo Runner

The Demo module simulates **5 realistic cyberattack scenarios** to showcase the full pipeline.

### Available Scenarios

| # | Scenario | MITRE ID | Events | What Happens |
|---|---|---|---|---|
| 1 | **Brute Force** | T1110 | 11 | 10 failed logins from one IP, then success |
| 2 | **Lateral Movement** | T1021 | 3 | Valid account login from unusual network segment + bulk data export |
| 3 | **Privilege Escalation** | T1548 | 4 | Low-privilege user runs 3 failed sudo commands, then escalates to root |
| 4 | **Credential Stuffing** | T1110 | 15 | Rapid login failures across 5 common usernames from 3 IPs |
| 5 | **Suspicious IP** | T1589 | 4 | Login attempts from a known malicious IP (KP, blacklist match) |

### Running Demos

```bash
# Run ALL 5 scenarios in sequence (~30 seconds)
bun run demo

# Run a specific scenario
bun run demo:brute-force
bun run demo:lateral
bun run demo:escalation
bun run demo:stuffing
bun run demo:suspicious

# Custom options
bun run runner.ts --backend http://your-server:8000 --scenario brute-force
bun run runner.ts --all --delay 2000 --quiet
```

### CLI Options

| Flag | Description | Default |
|---|---|---|
| `--backend <url>` | Backend server URL | `http://localhost:8000` |
| `--scenario <name>` | Run a specific scenario | — |
| `--all` | Run all 5 scenarios | `false` |
| `--delay <ms>` | Delay between scenarios | `1000` |
| `--quiet` | Suppress verbose output | `false` |

---

## 📡 API Reference

### Authentication

The API uses **two auth mechanisms**:

| Context | Method | Header |
|---|---|---|
| **SDK → Backend** (event ingestion) | API Key | `Authorization: Bearer <api-key>` or `X-API-Key: <key>` |
| **Dashboard → Backend** (data reads) | JWT | `Authorization: Bearer <jwt-token>` |

---

### Endpoints

<details>
<summary><b>POST /events</b> — Ingest a security event (API Key auth)</summary>

**Request:**
```json
{
  "projectId": "my-app",
  "event": "failed_login",
  "user": "admin",
  "ip": "192.168.1.5",
  "service": "auth-service",
  "timestamp": "2026-06-01T10:00:00Z",
  "metadata": { "reason": "invalid_password" }
}
```

**Response (200):**
```json
{ "status": "accepted", "id": "evt-abc123" }
```

**Errors:** `400` (invalid payload), `401` (bad API key), `429` (rate limited)
</details>

<details>
<summary><b>GET /events/latest</b> — Fetch recent events (JWT auth)</summary>

**Query Params:** `?projectId=my-app&limit=50`

**Response (200):**
```json
{
  "events": [
    {
      "id": "evt-abc123",
      "projectId": "my-app",
      "event": "failed_login",
      "user": "admin",
      "ip": "192.168.1.5",
      "timestamp": "2026-06-01T10:00:00Z",
      "metadata": {}
    }
  ],
  "total": 42
}
```
</details>

<details>
<summary><b>GET /alerts</b> — List threat alerts (JWT auth)</summary>

**Query Params:** `?projectId=my-app&limit=50`

**Response (200):**
```json
{
  "alerts": [
    {
      "id": "alert-xyz",
      "projectId": "my-app",
      "attack": "Brute Force",
      "severity": "High",
      "confidence": 0.95,
      "mitre": "T1110",
      "mitreName": "Brute Force",
      "reasoning": "10 rapid failed login attempts...",
      "recommendation": "Reset credentials, enable MFA...",
      "eventCount": 11,
      "status": "open",
      "createdAt": "2026-06-01T10:00:31Z"
    }
  ]
}
```
</details>

<details>
<summary><b>GET /alerts/:id</b> — Get alert details (JWT auth)</summary>

Returns the full alert object including `relatedEventIds` array.
</details>

<details>
<summary><b>PATCH /alerts/:id</b> — Update alert status (JWT auth)</summary>

**Request:**
```json
{ "status": "resolved" }
```

**Response (200):**
```json
{ "status": "updated" }
```
</details>

<details>
<summary><b>POST /analyze</b> — Trigger AI analysis manually (JWT/API Key auth)</summary>

**Request:**
```json
{
  "projectId": "my-app",
  "timewindow_minutes": 5
}
```

**Response (200):** Returns the newly created alert object.
</details>

<details>
<summary><b>POST /auth/login</b> — Admin credential login</summary>

**Request:**
```json
{
  "email": "admin@threatflix.dev",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "admin",
  "email": "admin@threatflix.dev"
}
```
</details>

<details>
<summary><b>POST /auth/oauth</b> — OAuth user registration/login</summary>

**Request:**
```json
{
  "email": "user@example.com",
  "name": "Jane Doe",
  "provider": "google"
}
```

**Response:** Returns JWT token + auto-generated project ID and API key.
</details>

<details>
<summary><b>Webhook Endpoints</b></summary>

| Method | Path | Description |
|---|---|---|
| `POST /webhooks` | Create a new webhook | `{ url, secret?, events? }` |
| `GET /webhooks` | List project webhooks | Returns active webhook configs |
| `DELETE /webhooks/:id` | Remove a webhook | — |
</details>

<details>
<summary><b>API Key Endpoints</b></summary>

| Method | Path | Description |
|---|---|---|
| `GET /apikeys` | List project API keys | Returns keys with metadata |
| `POST /apikeys` | Generate a new API key | `{ label }` |
</details>

<details>
<summary><b>Admin Endpoints</b></summary>

| Method | Path | Description |
|---|---|---|
| `GET /admin/stats` | Platform-wide statistics | Total events, alerts, projects |
| `GET /admin/projects` | List all projects | Project names with event counts |
</details>

<details>
<summary><b>GET /health</b> — Public health check</summary>

**Response (200):**
```json
{
  "status": "ok",
  "uptime": 3600,
  "database": "connected"
}
```
</details>

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI analysis | — (falls back to rules) |
| `GEMINI_MODEL` | Gemini model to use | `gemini-2.0-flash` |
| `PORT` | Backend server port | `8000` |
| `DATABASE_PATH` | SQLite database file path | `./data/threatflix.db` |
| `ADMIN_EMAIL` | Admin login email | `admin@threatflix.dev` |
| `ADMIN_PASSWORD` | Admin login password | `admin123` |
| `JWT_SECRET` | JWT signing secret | `threatflix-hackathon-secret...` |
| `JWT_EXPIRES_IN_SECONDS` | JWT token lifetime | `86400` (24h) |
| `ANALYSIS_COOLDOWN_MS` | Minimum gap between analyses per project | `120000` (2 min) |
| `ANALYSIS_EVENT_THRESHOLD` | Events needed to auto-trigger analysis | `5` |
| `ANALYSIS_MAX_PER_MINUTE` | Max analyses per minute per project | `5` |
| `ANALYSIS_GLOBAL_MAX_PER_MINUTE` | Max analyses per minute globally | `100` |
| `RATE_LIMIT_WINDOW_MS` | API rate limit window | `60000` (1 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max API requests per window per IP | `200` |

---

## 🎯 MITRE ATT&CK Mapping

ThreatFlix maps every detected threat to the [MITRE ATT&CK](https://attack.mitre.org/) framework. The backend contains a local dictionary of **23+ techniques** across multiple tactics:

| Tactic | Techniques |
|---|---|
| **Credential Access** | T1110 (Brute Force), T1110.001 (Password Guessing), T1110.003 (Password Spraying), T1110.004 (Credential Stuffing), T1040 (Network Sniffing), T1552 (Unsecured Credentials), T1556 (Modify Authentication Process) |
| **Initial Access** | T1078 (Valid Accounts), T1133 (External Remote Services), T1190 (Exploit Public-Facing Application) |
| **Lateral Movement** | T1021 (Remote Services) |
| **Privilege Escalation** | T1068 (Exploitation for Privilege Escalation) |
| **Persistence** | T1098 (Account Manipulation), T1136 (Create Account) |
| **Defense Evasion** | T1027 (Obfuscated Files), T1562 (Impair Defenses) |
| **Exfiltration** | T1048 (Exfiltration Over Alt Protocol), T1537 (Transfer Data to Cloud) |
| **Command and Control** | T1071 (Application Layer Protocol) |
| **Impact** | T1499 (Endpoint DoS), T1531 (Account Access Removal) |
| **Collection** | T1530 (Data from Cloud Storage), T1557 (Adversary-in-the-Middle) |

The AI is instructed to map to the most specific sub-technique when possible. If the LLM returns an unknown technique ID, the system preserves it and constructs a best-effort URL.

---

## 🔗 Webhook Integrations

ThreatFlix can push real-time alert notifications to external services via webhooks.

### Supported Events

| Event | Trigger |
|---|---|
| `alert.created` | When the AI produces a new threat alert |

### Webhook Payload

```json
{
  "event": "alert.created",
  "projectId": "my-app",
  "timestamp": "2026-06-01T10:00:31Z",
  "data": {
    "id": "alert-xyz",
    "attack": "Brute Force",
    "severity": "High",
    "confidence": 0.95,
    "mitre": "T1110",
    "reasoning": "...",
    "recommendation": "..."
  }
}
```

### Security Features

- **HMAC Signatures** — If a webhook secret is configured, every delivery includes an `X-ThreatFlix-Signature` header with a `sha256=...` HMAC for payload verification
- **Delivery Tracking** — Each delivery gets a unique `X-ThreatFlix-Delivery` ID
- **Timeout Protection** — Webhook calls time out after 10 seconds to prevent blocking
- **Non-blocking** — Webhook delivery is fire-and-forget; failures don't affect alert creation

### Integration Examples

| Service | Use Case |
|---|---|
| **Slack** | Post critical alerts to a `#security-alerts` channel |
| **n8n / Zapier** | Trigger automated incident response workflows |
| **PagerDuty** | Wake up your on-call team for critical severity threats |
| **Custom API** | Forward to your existing SIEM or ticketing system |

---

## 🔒 Security & Authentication

### Two Authentication Layers

```
┌────────────────────────────────────┐
│         SDK (Your App)             │
│                                    │
│   Authorization: Bearer <api-key>  │───▶  POST /events
│                                    │       (write-only, scoped to project)
└────────────────────────────────────┘

┌────────────────────────────────────┐
│         Dashboard (Browser)        │
│                                    │
│   Authorization: Bearer <jwt>      │───▶  GET /alerts, /events, PATCH, etc.
│                                    │       (read/write, role-based)
└────────────────────────────────────┘
```

### API Key Auth (SDK)

- API keys map to a specific `projectId`
- Keys are checked in this priority:
  1. `X-API-Key` header
  2. `Authorization: Bearer <key>` (if it matches a known key, not a JWT)
  3. `?apiKey=<key>` query parameter
- Keys can be created and revoked via the dashboard

### JWT Auth (Dashboard)

- Issued after login via `/auth/login` or `/auth/oauth`
- Contains: `sub` (user ID), `email`, `role`, `projectId`, `exp`
- Signed with HMAC-SHA256
- 24-hour expiration (configurable)

### Roles

| Role | Access |
|---|---|
| `admin` | All projects, admin endpoints, full CRUD |
| `user` | Own project only, read alerts/events, manage integrations |

### Rate Limiting

- **Per-IP:** 200 requests per minute per IP address
- **Per-project analysis:** 5 analyses per minute per project
- **Global analysis:** 100 analyses per minute across all projects
- **Analysis cooldown:** 2-minute minimum gap between analyses for the same project

---

## 🧰 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | [Bun](https://bun.sh/) | Ultra-fast JS/TS runtime, built-in SQLite, native HTTP server |
| **AI** | [Google Gemini](https://ai.google.dev/) (`gemini-2.0-flash`) | LLM-powered threat analysis with structured JSON output |
| **Database** | SQLite (via `bun:sqlite`) | Embedded database with WAL mode, migrations, and indexed queries |
| **Frontend** | React 19 + Vite 8 | Modern SPA with fast HMR |
| **Styling** | TailwindCSS 4 | Utility-first CSS framework |
| **Animations** | GSAP 3 | High-performance entrance animations and transitions |
| **Charts** | Recharts 3 | Data visualization for security metrics |
| **Routing** | React Router 7 | Client-side routing with protected routes |
| **Auth** | Custom JWT (HMAC-SHA256) | Lightweight auth with Bun's native `crypto.subtle` |
| **Security Framework** | MITRE ATT&CK | Industry-standard threat classification |
| **SDK** | TypeScript, zero deps | Universal client library (~2KB) |

---

## 🤝 Contributing

### Development Setup

```bash
# Clone the repo
git clone https://github.com/your-org/threatFlix.git
cd threatFlix

# Install all workspaces
cd Backend && bun install && cd ..
cd FrontEnd && bun install && cd ..
cd SDK && bun install && cd ..
cd Demo && bun install && cd ..

# Start everything (3 terminals)
# Terminal 1: Backend
cd Backend && bun run dev

# Terminal 2: Frontend
cd FrontEnd && bun run dev

# Terminal 3: Demo (optional)
cd Demo && bun run demo
```

### Adding a New Event Type

1. Add the event to the `EventType` enum in [`SDK/src/types.ts`](SDK/src/types.ts)
2. Add a convenience method to the `SecurityAI` class in [`SDK/src/index.ts`](SDK/src/index.ts)
3. Update the validation logic in [`Backend/src/middleware/validation.ts`](Backend/src/middleware/validation.ts)
4. Add a demo scenario in [`Demo/attack-scenarios.ts`](Demo/attack-scenarios.ts)

### Adding a New MITRE Technique

1. Add the technique to the dictionary in [`Backend/src/ai/mitre.ts`](Backend/src/ai/mitre.ts)
2. Optionally add to the demo reference in [`Demo/mitre-techniques.ts`](Demo/mitre-techniques.ts)
3. The LLM system prompt auto-includes all techniques from the dictionary

---

## 📄 License

This project is licensed under the **MIT License** — see individual `package.json` files for details.

---

<p align="center">
  <b>Built with 🛡️ by the ThreatFlix Team</b>
  <br />
  <sub>AI-powered security, from your first line of code.</sub>
</p>
