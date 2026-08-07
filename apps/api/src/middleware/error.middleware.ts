import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response
} from "express";
import { ZodError } from "zod";

import { logger } from "../infrastructure/logging/logger.js";
import { HttpError } from "../shared/errors.js";

export const errorMiddleware: ErrorRequestHandler = (
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const normalized = normalizeError(error);

  if (normalized.statusCode >= 500) {
    logger.error(
      {
        error,
        requestId: request.requestId
      },
      "Request failed"
    );
  } else {
    logger.warn(
      {
        error,
        requestId: request.requestId
      },
      "Request rejected"
    );
  }

  response.status(normalized.statusCode).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details
    },
    meta: {
      requestId: request.requestId
    }
  });
};

function normalizeError(error: unknown): {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
} {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: "validation_failed",
      message: "Request failed validation",
      details: error.flatten()
    };
  }

  if (error instanceof Error) {
    return {
      statusCode: 500,
      code: "internal_error",
      message: error.message
    };
  }

  return {
    statusCode: 500,
    code: "internal_error",
    message: "An unexpected error occurred"
  };
}
