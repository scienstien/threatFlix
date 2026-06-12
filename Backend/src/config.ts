// ---------------------------------------------------------------------------
// Centralized configuration — reads from process.env with sensible defaults.
// Forward-compat: swap to a config file or secrets manager later.
// ---------------------------------------------------------------------------

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is missing!");
}

export const config = {
  /** Server */
  port: Number(process.env.PORT ?? 8000),
  nodeEnv: process.env.NODE_ENV ?? "development",

  /** Database */
  databasePath: process.env.DATABASE_PATH ?? "./data/threatflix.db",

  /** Optional anomaly-scoring sidecar */
  mlServiceUrl: process.env.ML_SERVICE_URL ?? "http://localhost:8001",
  mlServiceTimeoutMs: Number(process.env.ML_SERVICE_TIMEOUT_MS ?? 2_000),

  /** Local Ollama interpretation layer */
  ollamaUrl: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "gemma4:latest",
  ollamaReportTimeoutMs: Number(process.env.OLLAMA_REPORT_TIMEOUT_MS ?? 120_000),
  ollamaChatTimeoutMs: Number(process.env.OLLAMA_CHAT_TIMEOUT_MS ?? 60_000),
  ollamaKeepAlive: process.env.OLLAMA_KEEP_ALIVE ?? "10m",

  /** Post-detection incident graph similarity */
  graphSimilarityEnabled: process.env.GRAPH_SIMILARITY_ENABLED !== "false",
  graphSimilarityMaxCandidates: Number(process.env.GRAPH_SIMILARITY_MAX_CANDIDATES ?? 500),
  graphSimilarityApiDefaultLimit: Number(process.env.GRAPH_SIMILARITY_API_DEFAULT_LIMIT ?? 5),
  graphSimilarityApiMaxLimit: Number(process.env.GRAPH_SIMILARITY_API_MAX_LIMIT ?? 20),
  graphSimilarityLlmLimit: Number(process.env.GRAPH_SIMILARITY_LLM_LIMIT ?? 3),
  graphSimilarityMinScore: Number(process.env.GRAPH_SIMILARITY_MIN_SCORE ?? 0.3),

  /** JWT */
  jwtSecret: jwtSecret,
  jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 86400), // 24h

  /** Analysis rate limiting / batching */
  analysisCooldownMs: Number(process.env.ANALYSIS_COOLDOWN_MS ?? 120_000),       // 2 min
  analysisEventThreshold: Number(process.env.ANALYSIS_EVENT_THRESHOLD ?? 5),      // events before trigger
  analysisMaxPerMinutePerProject: Number(process.env.ANALYSIS_MAX_PER_MINUTE ?? 5),
  analysisGlobalMaxPerMinute: Number(process.env.ANALYSIS_GLOBAL_MAX_PER_MINUTE ?? 100),
  demoDeferredAnalysis: process.env.THREATFLIX_DEMO_DEFER_ANALYSIS === "true",

  /** General API rate limiting */
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),          // 1 min
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 200),

} as const;

export type Config = typeof config;
