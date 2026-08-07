import {
  approvalRequestSchema,
  issueListResponseSchema,
  issueQuerySchema
} from "@triageforge/contracts";
import type { Router } from "express";
import express from "express";

import { asyncHandler } from "../../shared/async-handler.js";
import { requiredParam } from "../../shared/params.js";
import { validateBody, parseQuery } from "../../shared/validation.js";
import { requireAuth } from "../auth/auth-middleware.js";
import type { TriageService } from "../ai/triage-service.js";
import type { ApprovalService } from "./approval-service.js";
import type { IssueRepository } from "./issue-repository.js";

export function createIssueRouter(input: {
  issueRepository: IssueRepository;
  triageService: TriageService;
  approvalService: ApprovalService;
}): Router {
  const router = express.Router();

  router.get(
    "/repositories",
    requireAuth,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        data: await input.issueRepository.listRepositoriesForUser(
          request.auth!.user.id
        )
      });
    })
  );

  router.get(
    "/issues",
    requireAuth,
    asyncHandler(async (request, response) => {
      const query = parseQuery(issueQuerySchema, request.query);
      const result = await input.issueRepository.listIssuesForUser(
        request.auth!.user.id,
        query
      );

      response.status(200).json(
        issueListResponseSchema.parse({
          data: result.data,
          pageInfo: {
            nextCursor: result.nextCursor
          }
        })
      );
    })
  );

  router.get(
    "/issues/:id",
    requireAuth,
    asyncHandler(async (request, response) => {
      response.status(200).json({
        data: await input.issueRepository.getIssueDetailForUser(
          request.auth!.user.id,
          requiredParam(request, "id")
        )
      });
    })
  );

  router.post(
    "/issues/:id/triage",
    requireAuth,
    asyncHandler(async (request, response) => {
      const issueId = requiredParam(request, "id");

      await input.issueRepository.getIssueDetailForUser(
        request.auth!.user.id,
        issueId
      );
      await input.triageService.analyzeIssue(issueId);
      response.status(202).json({
        data: {
          status: "queued"
        }
      });
    })
  );

  router.post(
    "/issues/:id/approvals",
    requireAuth,
    validateBody(approvalRequestSchema),
    asyncHandler(async (request, response) => {
      const approval = approvalRequestSchema.parse(request.body);

      await input.approvalService.approveAndApply({
        userId: request.auth!.user.id,
        issueId: requiredParam(request, "id"),
        approval
      });

      response.status(202).json({
        data: {
          status: "applied"
        }
      });
    })
  );

  return router;
}
