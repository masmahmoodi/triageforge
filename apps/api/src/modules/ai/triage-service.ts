import type { AppConfig } from "../../config/env.js";
import { logger } from "../../infrastructure/logging/logger.js";
import type { IssueRepository } from "../issues/issue-repository.js";
import {
  buildEmbeddingText,
  OpenAIClient,
  type IssueForAi
} from "./openai-client.js";

export class TriageService {
  private readonly openaiClient: OpenAIClient;

  public constructor(
    private readonly issueRepository: IssueRepository,
    private readonly config: AppConfig
  ) {
    this.openaiClient = new OpenAIClient(config.openai);
  }

  public async analyzeIssue(issueId: string): Promise<"completed" | "failed"> {
    const pendingAnalysisId = await this.issueRepository.createPendingAnalysis({
      issueId,
      model: this.config.openai.triageModel,
      embeddingModel: this.config.openai.embeddingModel
    });

    try {
      const issue = await this.issueRepository.getIssueForTriage(issueId);
      const issueForAi: IssueForAi = {
        repositoryFullName: issue.repositoryFullName,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        authorLogin: issue.authorLogin
      };
      const analysis = await this.openaiClient.analyzeIssue(issueForAi);
      const embedding = await this.openaiClient.embedIssueText(
        buildEmbeddingText(issueForAi, analysis)
      );
      const similarIssues = await this.issueRepository.findSimilarIssues({
        repositoryId: issue.repositoryId,
        issueId: issue.id,
        embedding,
        limit: 5
      });

      await this.issueRepository.completeAnalysis({
        analysisId: pendingAnalysisId,
        analysis,
        embedding,
        similarIssues
      });
      return "completed";
    } catch (error) {
      logger.error({ error, issueId }, "Issue triage failed");
      await this.issueRepository.failAnalysis(pendingAnalysisId, error);
      return "failed";
    }
  }
}
