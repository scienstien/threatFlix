// ---------------------------------------------------------------------------
// Rate limiter — token bucket per key (IP or projectId).
// Also includes the AI analysis rate limiter and circuit breaker.
// Forward-compat: swap in-memory maps to Redis.
// ---------------------------------------------------------------------------

import { config } from "../config.ts";

// ---------------------------------------------------------------------------
// General API rate limiter
// ---------------------------------------------------------------------------

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

/** Check if a request is allowed under the rate limit. Returns remaining tokens or -1 if blocked. */
export function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: config.rateLimitMaxRequests, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= config.rateLimitWindowMs) {
    bucket.tokens = config.rateLimitMaxRequests;
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    const resetMs = config.rateLimitWindowMs - (now - bucket.lastRefill);
    return { allowed: false, remaining: 0, resetMs };
  }

  bucket.tokens--;
  return { allowed: true, remaining: bucket.tokens, resetMs: 0 };
}

/** Build a 429 Too Many Requests response. */
export function rateLimitResponse(resetMs: number): Response {
  return Response.json(
    { error: "Too many requests. Please slow down.", retryAfterMs: resetMs },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) },
    }
  );
}

// ---------------------------------------------------------------------------
// AI Analysis rate limiter (per-project cooldown + global circuit breaker)
// ---------------------------------------------------------------------------

interface AnalysisCooldown {
  lastAnalysis: number;
  countThisMinute: number;
  minuteStart: number;
}

const analysisCooldowns = new Map<string, AnalysisCooldown>();
let globalAnalysisCount = 0;
let globalMinuteStart = Date.now();

/** Check if AI analysis is allowed for a project right now. */
export function canRunAnalysis(projectId: string): {
  allowed: boolean;
  reason?: string;
} {
  const now = Date.now();

  // ---- Global circuit breaker ----
  if (now - globalMinuteStart >= 60_000) {
    globalAnalysisCount = 0;
    globalMinuteStart = now;
  }
  if (globalAnalysisCount >= config.analysisGlobalMaxPerMinute) {
    return { allowed: false, reason: "Global analysis rate limit reached. Circuit breaker active." };
  }

  // ---- Per-project cooldown ----
  let cooldown = analysisCooldowns.get(projectId);
  if (!cooldown) {
    cooldown = { lastAnalysis: 0, countThisMinute: 0, minuteStart: now };
    analysisCooldowns.set(projectId, cooldown);
  }

  // Reset per-minute counter
  if (now - cooldown.minuteStart >= 60_000) {
    cooldown.countThisMinute = 0;
    cooldown.minuteStart = now;
  }

  // Check cooldown
  const elapsed = now - cooldown.lastAnalysis;
  if (elapsed < config.analysisCooldownMs) {
    const waitMs = config.analysisCooldownMs - elapsed;
    return {
      allowed: false,
      reason: `Cooldown active for this project. Try again in ${Math.ceil(waitMs / 1000)}s.`,
    };
  }

  // Check per-project per-minute limit
  if (cooldown.countThisMinute >= config.analysisMaxPerMinutePerProject) {
    return {
      allowed: false,
      reason: `Max ${config.analysisMaxPerMinutePerProject} analyses per minute per project.`,
    };
  }

  return { allowed: true };
}

/** Record that an analysis was performed. Call this AFTER a successful LLM call. */
export function recordAnalysis(projectId: string): void {
  const now = Date.now();

  let cooldown = analysisCooldowns.get(projectId);
  if (!cooldown) {
    cooldown = { lastAnalysis: now, countThisMinute: 1, minuteStart: now };
    analysisCooldowns.set(projectId, cooldown);
  } else {
    cooldown.lastAnalysis = now;
    cooldown.countThisMinute++;
  }

  globalAnalysisCount++;
}

// ---------------------------------------------------------------------------
// Cleanup stale buckets periodically (prevent memory leak)
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > config.rateLimitWindowMs * 5) {
      buckets.delete(key);
    }
  }
  for (const [key, cooldown] of analysisCooldowns) {
    if (now - cooldown.lastAnalysis > config.analysisCooldownMs * 5) {
      analysisCooldowns.delete(key);
    }
  }
}, 300_000); // every 5 minutes
