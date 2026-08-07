import express, {
  type Request,
  type Response
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { loadConfig, type AppConfig } from "./config/env.js";
import { logger } from "./infrastructure/logging/logger.js";
import { corsMiddleware } from "./middleware/cors.middleware.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { csrfMiddleware, sessionMiddleware } from "./modules/auth/auth-middleware.js";
import { createAuthRouter } from "./modules/auth/auth-routes.js";
import { createGitHubRouter } from "./modules/github/github-routes.js";
import { createIssueRouter } from "./modules/issues/issue-routes.js";
import { badRequest } from "./shared/errors.js";
import { asyncHandler } from "./shared/async-handler.js";
import { createServices, type AppServices } from "./services.js";

export interface CreateAppOptions {
  config?: AppConfig;
  services?: AppServices;
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const config = options.config ?? loadConfig();
  const services = options.services ?? createServices(config);
  const app = express();

  app.disable("x-powered-by");
  app.locals.services = services;

  app.use(requestIdMiddleware);
  app.use(corsMiddleware(config));

  app.use(
    pinoHttp({
      logger,
      genReqId: (request) =>
        (request as unknown as Request).requestId
    })
  );

  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      limit: config.rateLimitMax,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (request) => request.path === "/api/v1/health"
    })
  );

  app.get(
    "/api/v1/health",
    (request: Request, response: Response): void => {
      response.status(200).json({
        data: {
          status: "ok"
        },
        meta: {
          requestId: request.requestId
        }
      });
    }
  );

  app.post(
    "/api/v1/github/webhooks",
    express.raw({
      type: "application/json",
      limit: "2mb"
    }),
    asyncHandler(async (request, response) => {
      if (!Buffer.isBuffer(request.body)) {
        throw badRequest("GitHub webhook body must be raw bytes");
      }

      const result = await services.webhookService.handleWebhook({
        rawBody: request.body,
        signature: request.header("x-hub-signature-256"),
        deliveryId: request.header("x-github-delivery"),
        eventName: request.header("x-github-event")
      });

      response.status(202).json({
        data: result
      });
    })
  );

  app.use(
    express.json({
      limit: "1mb"
    })
  );
  app.use(sessionMiddleware(services.authService));
  app.use(csrfMiddleware);
  app.use("/api/v1/auth", createAuthRouter(services.authService));
  app.use(
    "/api/v1/github",
    createGitHubRouter(services.githubAppService, config)
  );
  app.use(
    "/api/v1",
    createIssueRouter({
      issueRepository: services.issueRepository,
      triageService: services.triageService,
      approvalService: services.approvalService
    })
  );
  app.use(errorMiddleware);

  return app;
}
