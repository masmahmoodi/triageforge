import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../infrastructure/database/database.js";
import { logger } from "../../infrastructure/logging/logger.js";
import { badRequest, integrationUnavailable } from "../../shared/errors.js";
import type { TriageQueue } from "../ai/triage-queue.js";
import type { IssueRepository } from "../issues/issue-repository.js";
import { GitHubClient } from "./github-client.js";
import {
  githubIssuesWebhookPayloadSchema,
  type GitHubIssuesWebhookPayload
} from "./github-webhook-schemas.js";
import { verifyGitHubSignature } from "./webhook-signature.js";

export interface WebhookResult {
  status: "processed" | "duplicate" | "ignored";
  issueId?: string;
}

export class WebhookService {
  private readonly githubClient: GitHubClient;

  public constructor(
    private readonly database: Database,
    private readonly issueRepository: IssueRepository,
    private readonly triageQueue: TriageQueue,
    private readonly config: AppConfig
  ) {
    this.githubClient = new GitHubClient(config.github);
  }

  public async handleWebhook(input: {
    rawBody: Buffer;
    signature: string | undefined;
    deliveryId: string | undefined;
    eventName: string | undefined;
  }): Promise<WebhookResult> {
    if (!this.config.github.webhookSecret) {
      throw integrationUnavailable("GITHUB_WEBHOOK_SECRET is required to verify GitHub webhooks");
    }

    if (
      !verifyGitHubSignature({
        secret: this.config.github.webhookSecret,
        rawBody: input.rawBody,
        signatureHeader: input.signature
      })
    ) {
      throw badRequest("GitHub webhook signature verification failed");
    }

    if (!input.deliveryId || !input.eventName) {
      throw badRequest("GitHub webhook delivery and event headers are required");
    }

    const payload = parsePayload(input.rawBody);
    const action = getPayloadString(payload, "action");
    const repositoryFullName = getNestedPayloadString(payload, [
      "repository",
      "full_name"
    ]);
    const issueNumber = getNestedPayloadNumber(payload, ["issue", "number"]);

    const inserted = await this.database.transaction(async (client) => {
      const result = await client.query<{ delivery_id: string }>(
        `
          INSERT INTO webhook_deliveries (
            delivery_id,
            event_name,
            action,
            status,
            repository_full_name,
            issue_number,
            payload
          )
          VALUES ($1, $2, $3, 'processing', $4, $5, $6::jsonb)
          ON CONFLICT (delivery_id) DO NOTHING
          RETURNING delivery_id
        `,
        [
          input.deliveryId,
          input.eventName,
          action,
          repositoryFullName,
          issueNumber,
          JSON.stringify(payload)
        ]
      );

      return (result.rowCount ?? 0) > 0;
    });

    if (!inserted) {
      return {
        status: "duplicate"
      };
    }

    if (input.eventName !== "issues") {
      await this.markDelivery(input.deliveryId, "ignored");
      return {
        status: "ignored"
      };
    }

    try {
      const issuesPayload = githubIssuesWebhookPayloadSchema.parse(payload);
      const issueId = await this.persistIssuesEvent(issuesPayload);
      await this.markDelivery(input.deliveryId, "processed");
      this.triageQueue.enqueue(issueId);

      return {
        status: "processed",
        issueId
      };
    } catch (error) {
      await this.markDelivery(input.deliveryId, "failed", error);
      throw error;
    }
  }

  private async persistIssuesEvent(
    payload: GitHubIssuesWebhookPayload
  ): Promise<string> {
    const installation = await this.resolveInstallation(payload);

    return this.database.transaction(async (client) => {
      const installationDatabaseId =
        await this.issueRepository.upsertInstallation(client, installation);
      const repositoryDatabaseId = await this.issueRepository.upsertRepository(
        client,
        {
          installationDatabaseId,
          githubId: payload.repository.id,
          ownerLogin: payload.repository.owner.login,
          name: payload.repository.name,
          fullName: payload.repository.full_name,
          private: payload.repository.private,
          defaultBranch: payload.repository.default_branch ?? null,
          htmlUrl: payload.repository.html_url
        }
      );

      return this.issueRepository.upsertIssue(client, {
        repositoryDatabaseId,
        githubId: payload.issue.id,
        number: payload.issue.number,
        title: payload.issue.title,
        body: payload.issue.body,
        state: payload.issue.state,
        authorLogin: payload.issue.user?.login ?? null,
        labels: payload.issue.labels.map((label) => ({
          name: label.name,
          color: label.color ?? null,
          description: label.description ?? null
        })),
        assignees: payload.issue.assignees,
        commentsCount: payload.issue.comments,
        htmlUrl: payload.issue.html_url,
        githubCreatedAt: payload.issue.created_at,
        githubUpdatedAt: payload.issue.updated_at,
        closedAt: payload.issue.closed_at
      });
    });
  }

  private async resolveInstallation(payload: GitHubIssuesWebhookPayload) {
    try {
      return {
        userId: null,
        ...(await this.githubClient.getInstallation(payload.installation.id))
      };
    } catch (error) {
      logger.warn(
        { error, installationId: payload.installation.id },
        "Falling back to webhook installation metadata"
      );

      return {
        userId: null,
        installationId: payload.installation.id,
        accountLogin: payload.repository.owner.login,
        accountType: "Unknown",
        targetType: null,
        permissions: {},
        events: [],
        suspendedAt: null
      };
    }
  }

  private async markDelivery(
    deliveryId: string,
    status: "processed" | "ignored" | "failed",
    error?: unknown
  ): Promise<void> {
    await this.database.query(
      `
        UPDATE webhook_deliveries
        SET status = $2,
            error_message = $3,
            processed_at = now()
        WHERE delivery_id = $1
      `,
      [deliveryId, status, error ? getErrorMessage(error) : null]
    );
  }
}

function parsePayload(rawBody: Buffer): unknown {
  try {
    return JSON.parse(rawBody.toString("utf8")) as unknown;
  } catch {
    throw badRequest("GitHub webhook body must be valid JSON");
  }
}

function getPayloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function getNestedPayloadString(payload: unknown, keys: string[]): string | null {
  const value = getNestedPayloadValue(payload, keys);
  return typeof value === "string" ? value : null;
}

function getNestedPayloadNumber(payload: unknown, keys: string[]): number | null {
  const value = getNestedPayloadValue(payload, keys);
  return typeof value === "number" ? value : null;
}

function getNestedPayloadValue(payload: unknown, keys: string[]): unknown {
  let current = payload;

  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
