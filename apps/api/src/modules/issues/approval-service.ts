import type { ApprovalRequest } from "@triageforge/contracts";

import { badRequest } from "../../shared/errors.js";
import { GitHubClient, type GitHubLabelInput } from "../github/github-client.js";
import type { IssueRepository } from "./issue-repository.js";
import type { AppConfig } from "../../config/env.js";

export class ApprovalService {
  private readonly githubClient: GitHubClient;

  public constructor(
    private readonly issueRepository: IssueRepository,
    config: AppConfig
  ) {
    this.githubClient = new GitHubClient(config.github);
  }

  public async approveAndApply(input: {
    userId: string;
    issueId: string;
    approval: ApprovalRequest;
  }): Promise<void> {
    const labels = uniqueStrings(input.approval.labels);
    const comment = input.approval.comment?.trim() || null;

    if (labels.length === 0 && !comment) {
      throw badRequest("At least one label or comment is required");
    }

    const issue = await this.issueRepository.getIssueForApproval(
      input.userId,
      input.issueId
    );
    const analysis = await this.issueRepository.getAnalysisForIssue(
      input.issueId,
      input.approval.analysisId
    );

    if (analysis.status !== "completed" || !analysis.analysis) {
      throw badRequest("Only completed triage analyses can be approved");
    }

    if (
      await this.issueRepository.hasAppliedApprovalForAnalysis({
        issueId: input.issueId,
        analysisId: input.approval.analysisId
      })
    ) {
      throw badRequest("This triage analysis has already been applied to GitHub");
    }

    const approvalId = await this.issueRepository.createApproval({
      issueId: input.issueId,
      analysisId: input.approval.analysisId,
      userId: input.userId,
      labels,
      comment
    });

    try {
      const labelInputs = buildLabelInputs(labels, analysis.analysis.suggestedLabels);
      await this.githubClient.ensureLabels(
        issue.githubInstallationId,
        issue.ownerLogin,
        issue.repoName,
        labelInputs
      );
      await this.githubClient.addIssueLabels({
        installationId: issue.githubInstallationId,
        owner: issue.ownerLogin,
        repo: issue.repoName,
        issueNumber: issue.number,
        labels
      });
      const githubCommentId = comment
        ? await this.githubClient.createIssueComment({
            installationId: issue.githubInstallationId,
            owner: issue.ownerLogin,
            repo: issue.repoName,
            issueNumber: issue.number,
            body: comment
          })
        : null;

      await this.issueRepository.markApprovalApplied(
        approvalId,
        githubCommentId
      );
    } catch (error) {
      await this.issueRepository.markApprovalFailed(approvalId, error);
      throw error;
    }
  }
}

function buildLabelInputs(
  labels: string[],
  suggestions: Array<{
    name: string;
    color: string | null;
    rationale: string;
  }>
): GitHubLabelInput[] {
  const suggestionMap = new Map(
    suggestions.map((label) => [label.name.toLowerCase(), label])
  );

  return labels.map((name) => {
    const suggestion = suggestionMap.get(name.toLowerCase());

    return {
      name,
      color: suggestion?.color ?? "ededed",
      description: suggestion?.rationale ?? "Applied from TriageForge review"
    };
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
