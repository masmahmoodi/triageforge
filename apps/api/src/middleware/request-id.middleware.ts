import { randomUUID } from "node:crypto";
import type {
  NextFunction,
  Request,
  Response
} from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const suppliedRequestId = request.header("x-request-id")?.trim();

  const requestId =
    suppliedRequestId &&
    SAFE_REQUEST_ID_PATTERN.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

  request.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);

  next();
}