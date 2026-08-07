import {
  authResponseSchema,
  loginRequestSchema,
  registerRequestSchema
} from "@triageforge/contracts";
import type { Router } from "express";
import express from "express";

import { asyncHandler } from "../../shared/async-handler.js";
import { validateBody } from "../../shared/validation.js";
import type { AuthService } from "./auth-service.js";
import { requireAuth } from "./auth-middleware.js";

export function createAuthRouter(authService: AuthService): Router {
  const router = express.Router();

  router.post(
    "/register",
    validateBody(registerRequestSchema),
    asyncHandler(async (request, response) => {
      const body = registerRequestSchema.parse(request.body);
      const result = await authService.register({
        email: body.email,
        name: body.name,
        password: body.password,
        userAgent: request.header("user-agent"),
        ipAddress: request.ip
      });

      authService.setSessionCookie(
        response,
        result.cookieValue,
        result.auth.session.expiresAt
      );

      response.status(201).json(
        authResponseSchema.parse({
          data: {
            user: result.auth.user,
            csrfToken: result.auth.session.csrfToken
          }
        })
      );
    })
  );

  router.post(
    "/login",
    validateBody(loginRequestSchema),
    asyncHandler(async (request, response) => {
      const body = loginRequestSchema.parse(request.body);
      const result = await authService.login({
        email: body.email,
        password: body.password,
        userAgent: request.header("user-agent"),
        ipAddress: request.ip
      });

      authService.setSessionCookie(
        response,
        result.cookieValue,
        result.auth.session.expiresAt
      );

      response.status(200).json(
        authResponseSchema.parse({
          data: {
            user: result.auth.user,
            csrfToken: result.auth.session.csrfToken
          }
        })
      );
    })
  );

  router.post(
    "/logout",
    asyncHandler(async (request, response) => {
      const auth =
        request.auth ?? await authService.resolveSession(request.header("cookie"));

      if (auth) {
        await authService.revokeSession(auth.session.id);
      }

      authService.clearSessionCookie(response);
      response.status(204).send();
    })
  );

  router.get(
    "/me",
    requireAuth,
    (request, response) => {
      response.status(200).json(
        authResponseSchema.parse({
          data: {
            user: request.auth!.user,
            csrfToken: request.auth!.session.csrfToken
          }
        })
      );
    }
  );

  return router;
}
