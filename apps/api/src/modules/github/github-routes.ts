import { githubSetupUrlResponseSchema } from "@triageforge/contracts";
import type { Router } from "express";
import express from "express";

import type { AppConfig } from "../../config/env.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { badRequest } from "../../shared/errors.js";
import { requiredParam } from "../../shared/params.js";
import { requireAuth } from "../auth/auth-middleware.js";
import type { GitHubAppService } from "./github-app-service.js";

export function createGitHubRouter(
  githubAppService: GitHubAppService,
  config: AppConfig
): Router {
  const router = express.Router();

  router.get(
    "/app/setup-url",
    requireAuth,
    asyncHandler(async (request, response) => {
      const url = await githubAppService.createSetupUrl(request.auth!.user.id);

      response.status(200).json(
        githubSetupUrlResponseSchema.parse({
          data: {
            url
          }
        })
      );
    })
  );

  router.get(
    "/app/callback",
    requireAuth,
    asyncHandler(async (request, response) => {
      const state =
        typeof request.query.state === "string" ? request.query.state : "";
      const installationId = Number(request.query.installation_id);

      if (!state || !Number.isInteger(installationId)) {
        throw badRequest("GitHub callback requires state and installation_id");
      }

      await githubAppService.handleCallback({
        userId: request.auth!.user.id,
        installationId,
        state
      });

      response.redirect(303, `${config.webOrigin}/github/callback?connected=1`);
    })
  );

  router.get(
    "/installations",
    requireAuth,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        data: await githubAppService.listInstallations(request.auth!.user.id)
      });
    })
  );

  router.post(
    "/installations/:id/sync",
    requireAuth,
    asyncHandler(async (request, response) => {
      await githubAppService.syncInstallation(
        request.auth!.user.id,
        requiredParam(request, "id")
      );

      response.status(204).send();
    })
  );

  return router;
}
