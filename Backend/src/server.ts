import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { getDb, closeDb } from "./db/database.ts";
import { startReportWorker } from "./ai/llmWorker.ts";

console.log("\nThreatFlix Backend");
console.log("=".repeat(32));
console.log(`Environment: ${config.nodeEnv}`);
console.log(`Port: ${config.port}`);
console.log(`Database: ${config.databasePath}`);
console.log(`LLM Interpretation: Ollama ${config.ollamaModel} at ${config.ollamaUrl}`);
console.log("=".repeat(32));

getDb();
console.log("Database initialized.");
startReportWorker();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
  console.log("Routes:");
  console.log("  GET    /health");
  console.log("  POST   /events");
  console.log("  GET    /events/latest");
  console.log("  GET    /alerts");
  console.log("  GET    /alerts/:id");
  console.log("  PATCH  /alerts/:id");
  console.log("  POST   /analyze");
  console.log("  GET    /investigations/:id/report");
  console.log("  POST   /investigations/:id/report/regenerate");
  console.log("  GET    /investigations/:id/chat");
  console.log("  POST   /investigations/:id/chat");
  console.log("  GET    /webhooks");
  console.log("  POST   /webhooks");
  console.log("  DELETE /webhooks/:id");
  console.log("  GET    /apikeys");
  console.log("  POST   /apikeys");
  console.log("  GET    /admin/stats");
  console.log("  GET    /admin/projects");
});

function shutdown() {
  console.log("\nShutting down...");
  closeDb();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
