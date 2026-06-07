// ---------------------------------------------------------------------------
// Centralized configuration — reads from process.env with sensible defaults.
// Forward-compat: swap to a config file or secrets manager later.
// ---------------------------------------------------------------------------

export const config = {
  /** Server */
  port: Number(process.env.PORT ?? 8000),
  nodeEnv: process.env.NODE_ENV ?? "development",

  /** Database */
  databasePath: process.env.DATABASE_PATH ?? "./data/threatflix.db",

  /** Gemini AI */
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",

  /** JWT */
  jwtSecret: process.env.JWT_SECRET ?? "threatflix-app-secret-change-in-production",
  jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 86400), // 24h

  /** Analysis rate limiting / batching */
  analysisCooldownMs: Number(process.env.ANALYSIS_COOLDOWN_MS ?? 120_000),       // 2 min
  analysisEventThreshold: Number(process.env.ANALYSIS_EVENT_THRESHOLD ?? 5),      // events before trigger
  analysisMaxPerMinutePerProject: Number(process.env.ANALYSIS_MAX_PER_MINUTE ?? 5),
  analysisGlobalMaxPerMinute: Number(process.env.ANALYSIS_GLOBAL_MAX_PER_MINUTE ?? 100),

  /** General API rate limiting */
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),          // 1 min
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 200),

} as const;

export type Config = typeof config;
