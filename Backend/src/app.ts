import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.ts";
import { eventsRouter } from "./routes/events.ts";
import { alertsRouter } from "./routes/alerts.ts";
import { analyzeRouter } from "./routes/analyze.ts";
import { webhooksRouter } from "./routes/webhookRoutes.ts";
import { apiKeysRouter } from "./routes/apiKeysRoutes.ts";
import { adminRouter } from "./routes/admin.ts";
import { authRouter } from "./routes/authRoutes.ts";
import { checkRateLimit } from "./middleware/rateLimit.ts";
import { investigationsRouter } from "./routes/investigations.ts";

export function createApp() {
  const app = express();

  app.set("trust proxy", true);
  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    const rateKey = req.ip || "unknown";
    const result = checkRateLimit(rateKey);

    if (!result.allowed) {
      res.setHeader("Retry-After", String(Math.ceil(result.resetMs / 1000)));
      return res.status(429).json({
        error: "Too many requests. Please slow down.",
        retryAfterMs: result.resetMs,
      });
    }

    next();
  });

  app.use("/api/health", healthRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/alerts", alertsRouter);
  app.use("/api/investigations", investigationsRouter);
  app.use("/api/analyze", analyzeRouter);
  app.use("/api/webhooks", webhooksRouter);
  app.use("/api/apikeys", apiKeysRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/auth", authRouter);

  app.use((req, res) => {
    res.status(404).json({
      error: "Not found.",
      path: req.originalUrl,
      method: req.method,
    });
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled server error:", error);
    res.status(500).json({
      error: "Internal server error.",
      message: error.message,
    });
  });

  return app;
}
