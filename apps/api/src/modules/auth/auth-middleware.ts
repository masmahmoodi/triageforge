import type {
  NextFunction,
  Request,
  RequestHandler,
  Response
} from "express";

import { forbidden, unauthorized } from "../../shared/errors.js";
import type { AuthService } from "./auth-service.js";
import type { AuthContext } from "./auth-types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function sessionMiddleware(authService: AuthService): RequestHandler {
  return async (request, _response, next) => {
    try {
      const auth = await authService.resolveSession(request.header("cookie"));

      if (auth) {
        request.auth = auth;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  if (!request.auth) {
    next(unauthorized());
    return;
  }

  next();
}

export function csrfMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  if (
    isAuthSessionEndpoint(request) ||
    !request.auth ||
    !isUnsafeMethod(request.method)
  ) {
    next();
    return;
  }

  const token = request.header("x-csrf-token");

  if (!token || token !== request.auth.session.csrfToken) {
    next(forbidden("A valid CSRF token is required"));
    return;
  }

  next();
}

function isUnsafeMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function isAuthSessionEndpoint(request: Request): boolean {
  return (
    request.method === "POST" &&
    [
      "/api/v1/auth/login",
      "/api/v1/auth/logout",
      "/api/v1/auth/register"
    ].includes(request.path)
  );
}
