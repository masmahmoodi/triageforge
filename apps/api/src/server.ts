import { createApp } from "./app.js";
import { logger } from "./infrastructure/logging/logger.js";

const API_PORT = 4000;
const app = createApp();

const server = app.listen(API_PORT, "127.0.0.1", () => {
  logger.info(
    {
      host: "127.0.0.1",
      port: API_PORT
    },
    "TriageForge API is listening"
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, "API shutdown requested");

  server.close((error) => {
    if (error) {
      logger.error({ error }, "API shutdown failed");
      process.exitCode = 1;
      return;
    }

    logger.info("API shutdown completed");
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});