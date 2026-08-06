import express, {
  type Request,
  type Response
} from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { logger } from "./infrastructure/logging/logger.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");

  app.use(requestIdMiddleware);

  app.use(
    pinoHttp({
      logger,
      genReqId: (request) =>
        (request as unknown as Request).requestId
    })
  );

  app.use(helmet());

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

  return app;
}