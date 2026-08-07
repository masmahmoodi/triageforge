import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { logger } from "./infrastructure/logging/logger.js";
import { createServices } from "./services.js";

const config = loadConfig();
const services = createServices(config);
const app = createApp({
  config,
  services
});

const server = app.listen(config.apiPort, config.apiHost, () => {
  logger.info(
    {
      host: config.apiHost,
      port: config.apiPort
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

    services.database
      .close()
      .then(() => {
        logger.info("API shutdown completed");
      })
      .catch((closeError: unknown) => {
        logger.error({ error: closeError }, "Database shutdown failed");
        process.exitCode = 1;
      });
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
