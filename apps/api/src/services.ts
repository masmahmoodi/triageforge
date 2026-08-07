import type { AppConfig } from "./config/env.js";
import { Database } from "./infrastructure/database/database.js";
import { TriageQueue } from "./modules/ai/triage-queue.js";
import { TriageService } from "./modules/ai/triage-service.js";
import { AuthService } from "./modules/auth/auth-service.js";
import { GitHubAppService } from "./modules/github/github-app-service.js";
import { WebhookService } from "./modules/github/webhook-service.js";
import { ApprovalService } from "./modules/issues/approval-service.js";
import { IssueRepository } from "./modules/issues/issue-repository.js";

export interface AppServices {
  database: Database;
  authService: AuthService;
  issueRepository: IssueRepository;
  triageService: TriageService;
  triageQueue: TriageQueue;
  approvalService: ApprovalService;
  githubAppService: GitHubAppService;
  webhookService: WebhookService;
}

export function createServices(config: AppConfig): AppServices {
  const database = new Database(config.databaseUrl);
  const issueRepository = new IssueRepository(database);
  const triageService = new TriageService(issueRepository, config);
  const triageQueue = new TriageQueue(triageService);

  return {
    database,
    authService: new AuthService(database, config),
    issueRepository,
    triageService,
    triageQueue,
    approvalService: new ApprovalService(issueRepository, config),
    githubAppService: new GitHubAppService(database, issueRepository, config),
    webhookService: new WebhookService(
      database,
      issueRepository,
      triageQueue,
      config
    )
  };
}
