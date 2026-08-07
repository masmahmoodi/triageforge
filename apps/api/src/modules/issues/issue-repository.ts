import {
  issueDetailSchema,
  issueListItemSchema,
  triageAnalysisSchema,
  type AiIssueAnalysis,
  type IssueDetail,
  type IssueListItem,
  type IssueQuery,
  type SimilarIssue,
  type TriageAnalysis
} from "@triageforge/contracts";

import type { Database, Queryable, QueryResultRow } from "../../infrastructure/database/database.js";
import { forbidden, notFound } from "../../shared/errors.js";
import { decodeIssueCursor, encodeIssueCursor } from "./cursor.js";

export interface InstallationInput {
  userId?: string | null;
  installationId: number;
  accountLogin: string;
  accountType: string;
  targetType: string | null;
  permissions: Record<string, string>;
  events: string[];
  suspendedAt: string | null;
}

export interface RepositoryInput {
  installationDatabaseId: string;
  githubId: number;
  ownerLogin: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string | null;
  htmlUrl: string;
}

export interface IssueInput {
  repositoryDatabaseId: string;
  githubId: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  authorLogin: string | null;
  labels: Array<{
    name: string;
    color?: string | null;
    description?: string | null;
  }>;
  assignees: Array<{ login: string }>;
  commentsCount: number;
  htmlUrl: string;
  githubCreatedAt: string;
  githubUpdatedAt: string;
  closedAt: string | null;
}

export interface IssueForTriage {
  id: string;
  repositoryId: string;
  repositoryFullName: string;
  number: number;
  title: string;
  body: string | null;
  labels: string[];
  authorLogin: string | null;
}

export interface IssueForApproval {
  id: string;
  number: number;
  title: string;
  repositoryId: string;
  ownerLogin: string;
  repoName: string;
  repositoryFullName: string;
  githubInstallationId: number;
}

interface IssueListRow extends QueryResultRow {
  id: string;
  repository_id: string;
  number: number;
  title: string;
  state: "open" | "closed";
  author_login: string | null;
  label_names: string[];
  priority: "low" | "medium" | "high" | "urgent" | null;
  analysis_status: "pending" | "completed" | "failed" | null;
  html_url: string;
  github_created_at: Date;
  github_updated_at: Date;
}

interface IssueDetailRow extends IssueListRow {
  body: string | null;
  repository: unknown;
}

interface TriageAnalysisRow extends QueryResultRow {
  id: string;
  issue_id: string;
  status: "pending" | "completed" | "failed";
  model: string | null;
  embedding_model: string | null;
  analysis: AiIssueAnalysis | null;
  error_message: string | null;
  created_at: Date;
}

export class IssueRepository {
  public constructor(private readonly database: Database) {}

  public async upsertInstallation(
    client: Queryable,
    input: InstallationInput
  ): Promise<string> {
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO github_installations (
          user_id,
          installation_id,
          account_login,
          account_type,
          target_type,
          permissions,
          events,
          suspended_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
        ON CONFLICT (installation_id) DO UPDATE SET
          user_id = COALESCE(EXCLUDED.user_id, github_installations.user_id),
          account_login = EXCLUDED.account_login,
          account_type = EXCLUDED.account_type,
          target_type = EXCLUDED.target_type,
          permissions = EXCLUDED.permissions,
          events = EXCLUDED.events,
          suspended_at = EXCLUDED.suspended_at,
          updated_at = now()
        RETURNING id
      `,
      [
        input.userId ?? null,
        input.installationId,
        input.accountLogin,
        input.accountType,
        input.targetType,
        JSON.stringify(input.permissions),
        input.events,
        input.suspendedAt
      ]
    );

    return requireRow(result.rows[0]).id;
  }

  public async upsertRepository(
    client: Queryable,
    input: RepositoryInput
  ): Promise<string> {
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO repositories (
          installation_id,
          github_id,
          owner_login,
          name,
          full_name,
          private,
          default_branch,
          html_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (github_id) DO UPDATE SET
          installation_id = EXCLUDED.installation_id,
          owner_login = EXCLUDED.owner_login,
          name = EXCLUDED.name,
          full_name = EXCLUDED.full_name,
          private = EXCLUDED.private,
          default_branch = EXCLUDED.default_branch,
          html_url = EXCLUDED.html_url,
          updated_at = now()
        RETURNING id
      `,
      [
        input.installationDatabaseId,
        input.githubId,
        input.ownerLogin,
        input.name,
        input.fullName,
        input.private,
        input.defaultBranch,
        input.htmlUrl
      ]
    );

    return requireRow(result.rows[0]).id;
  }

  public async upsertIssue(client: Queryable, input: IssueInput): Promise<string> {
    const labelNames = input.labels.map((label) => label.name);
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO issues (
          repository_id,
          github_id,
          number,
          title,
          body,
          state,
          author_login,
          labels,
          label_names,
          assignees,
          comments_count,
          html_url,
          github_created_at,
          github_updated_at,
          closed_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9,
          $10::jsonb, $11, $12, $13, $14, $15
        )
        ON CONFLICT (repository_id, number) DO UPDATE SET
          github_id = EXCLUDED.github_id,
          title = EXCLUDED.title,
          body = EXCLUDED.body,
          state = EXCLUDED.state,
          author_login = EXCLUDED.author_login,
          labels = EXCLUDED.labels,
          label_names = EXCLUDED.label_names,
          assignees = EXCLUDED.assignees,
          comments_count = EXCLUDED.comments_count,
          html_url = EXCLUDED.html_url,
          github_created_at = EXCLUDED.github_created_at,
          github_updated_at = EXCLUDED.github_updated_at,
          closed_at = EXCLUDED.closed_at,
          updated_at = now()
        RETURNING id
      `,
      [
        input.repositoryDatabaseId,
        input.githubId,
        input.number,
        input.title,
        input.body,
        input.state,
        input.authorLogin,
        JSON.stringify(input.labels),
        labelNames,
        JSON.stringify(input.assignees),
        input.commentsCount,
        input.htmlUrl,
        input.githubCreatedAt,
        input.githubUpdatedAt,
        input.closedAt
      ]
    );

    return requireRow(result.rows[0]).id;
  }

  public async listRepositoriesForUser(userId: string): Promise<unknown[]> {
    const result = await this.database.query(
      `
        SELECT
          r.id,
          r.github_id AS "githubId",
          r.installation_id AS "installationId",
          r.owner_login AS "ownerLogin",
          r.name,
          r.full_name AS "fullName",
          r.private,
          r.default_branch AS "defaultBranch",
          r.html_url AS "htmlUrl",
          r.connected_at AS "connectedAt",
          r.updated_at AS "updatedAt"
        FROM repositories r
        JOIN github_installations gi ON gi.id = r.installation_id
        WHERE gi.user_id = $1
          AND r.enabled = true
        ORDER BY r.full_name ASC
      `,
      [userId]
    );

    return result.rows.map((row) => ({
      ...row,
      githubId: String(row.githubId),
      connectedAt: toIso(row.connectedAt),
      updatedAt: toIso(row.updatedAt)
    }));
  }

  public async listIssuesForUser(
    userId: string,
    query: IssueQuery
  ): Promise<{ data: IssueListItem[]; nextCursor: string | null }> {
    const cursor = decodeIssueCursor(query.cursor);
    const params: unknown[] = [userId];
    const where = ["gi.user_id = $1"];

    if (query.repositoryId) {
      params.push(query.repositoryId);
      where.push(`i.repository_id = $${params.length}`);
    }

    if (query.state) {
      params.push(query.state);
      where.push(`i.state = $${params.length}`);
    }

    if (query.label) {
      params.push(query.label);
      where.push(`EXISTS (
        SELECT 1
        FROM unnest(i.label_names) AS label_name
        WHERE lower(label_name) = lower($${params.length})
      )`);
    }

    if (query.q) {
      params.push(query.q);
      where.push(`i.search_vector @@ plainto_tsquery('english', $${params.length})`);
    }

    if (query.priority) {
      params.push(query.priority);
      where.push(`latest.priority = $${params.length}`);
    }

    if (cursor) {
      params.push(cursor.githubUpdatedAt, cursor.id);
      where.push(`(i.github_updated_at, i.id) < ($${params.length - 1}, $${params.length})`);
    }

    params.push(query.limit + 1);
    const limitParameter = `$${params.length}`;
    const result = await this.database.query<IssueListRow>(
      `
        SELECT
          i.id,
          i.repository_id,
          i.number,
          i.title,
          i.state,
          i.author_login,
          i.label_names,
          latest.priority,
          latest.status AS analysis_status,
          i.html_url,
          i.github_created_at,
          i.github_updated_at
        FROM issues i
        JOIN repositories r ON r.id = i.repository_id
        JOIN github_installations gi ON gi.id = r.installation_id
        LEFT JOIN LATERAL (
          SELECT status, priority
          FROM triage_analyses ta
          WHERE ta.issue_id = i.id
          ORDER BY ta.created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE ${where.join(" AND ")}
        ORDER BY i.github_updated_at DESC, i.id DESC
        LIMIT ${limitParameter}
      `,
      params
    );
    const rows = result.rows;
    const pageRows = rows.slice(0, query.limit);
    const nextRow = rows[query.limit];

    return {
      data: pageRows.map(mapIssueListItem),
      nextCursor: nextRow
        ? encodeIssueCursor({
            githubUpdatedAt: nextRow.github_updated_at.toISOString(),
            id: nextRow.id
          })
        : null
    };
  }

  public async getIssueDetailForUser(
    userId: string,
    issueId: string
  ): Promise<IssueDetail> {
    const result = await this.database.query<IssueDetailRow>(
      `
        SELECT
          i.id,
          i.repository_id,
          i.number,
          i.title,
          i.body,
          i.state,
          i.author_login,
          i.label_names,
          latest.priority,
          latest.status AS analysis_status,
          i.html_url,
          i.github_created_at,
          i.github_updated_at,
          jsonb_build_object(
            'id', r.id,
            'githubId', r.github_id::text,
            'installationId', r.installation_id,
            'ownerLogin', r.owner_login,
            'name', r.name,
            'fullName', r.full_name,
            'private', r.private,
            'defaultBranch', r.default_branch,
            'htmlUrl', r.html_url,
            'connectedAt', r.connected_at,
            'updatedAt', r.updated_at
          ) AS repository
        FROM issues i
        JOIN repositories r ON r.id = i.repository_id
        JOIN github_installations gi ON gi.id = r.installation_id
        LEFT JOIN LATERAL (
          SELECT status, priority
          FROM triage_analyses ta
          WHERE ta.issue_id = i.id
          ORDER BY ta.created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE i.id = $1
          AND gi.user_id = $2
      `,
      [issueId, userId]
    );
    const row = result.rows[0];

    if (!row) {
      throw notFound("Issue not found");
    }

    const latestAnalysis = await this.getLatestAnalysis(issueId);
    const approvals = await this.getApprovals(issueId);

    return issueDetailSchema.parse({
      ...mapIssueListItem(row),
      body: row.body,
      repository: normalizeRepositoryJson(row.repository),
      latestAnalysis,
      approvals
    });
  }

  public async getIssueForTriage(issueId: string): Promise<IssueForTriage> {
    const result = await this.database.query<{
      id: string;
      repository_id: string;
      full_name: string;
      number: number;
      title: string;
      body: string | null;
      label_names: string[];
      author_login: string | null;
    }>(
      `
        SELECT
          i.id,
          i.repository_id,
          r.full_name,
          i.number,
          i.title,
          i.body,
          i.label_names,
          i.author_login
        FROM issues i
        JOIN repositories r ON r.id = i.repository_id
        WHERE i.id = $1
      `,
      [issueId]
    );
    const row = result.rows[0];

    if (!row) {
      throw notFound("Issue not found");
    }

    return {
      id: row.id,
      repositoryId: row.repository_id,
      repositoryFullName: row.full_name,
      number: row.number,
      title: row.title,
      body: row.body,
      labels: row.label_names,
      authorLogin: row.author_login
    };
  }

  public async getIssueForApproval(
    userId: string,
    issueId: string
  ): Promise<IssueForApproval> {
    const result = await this.database.query<{
      id: string;
      number: number;
      title: string;
      repository_id: string;
      owner_login: string;
      name: string;
      full_name: string;
      installation_id: string;
    }>(
      `
        SELECT
          i.id,
          i.number,
          i.title,
          r.id AS repository_id,
          r.owner_login,
          r.name,
          r.full_name,
          gi.installation_id
        FROM issues i
        JOIN repositories r ON r.id = i.repository_id
        JOIN github_installations gi ON gi.id = r.installation_id
        WHERE i.id = $1
          AND gi.user_id = $2
      `,
      [issueId, userId]
    );
    const row = result.rows[0];

    if (!row) {
      throw notFound("Issue not found");
    }

    return {
      id: row.id,
      number: row.number,
      title: row.title,
      repositoryId: row.repository_id,
      ownerLogin: row.owner_login,
      repoName: row.name,
      repositoryFullName: row.full_name,
      githubInstallationId: Number(row.installation_id)
    };
  }

  public async createPendingAnalysis(input: {
    issueId: string;
    model: string;
    embeddingModel: string;
  }): Promise<string> {
    const result = await this.database.query<{ id: string }>(
      `
        INSERT INTO triage_analyses (issue_id, status, model, embedding_model)
        VALUES ($1, 'pending', $2, $3)
        RETURNING id
      `,
      [input.issueId, input.model, input.embeddingModel]
    );

    return requireRow(result.rows[0]).id;
  }

  public async completeAnalysis(input: {
    analysisId: string;
    analysis: AiIssueAnalysis;
    embedding: number[];
    similarIssues: SimilarIssue[];
  }): Promise<void> {
    await this.database.transaction(async (client) => {
      await client.query(
        `
          UPDATE triage_analyses
          SET
            status = 'completed',
            priority = $2,
            suggested_label_names = $3,
            analysis = $4::jsonb,
            embedding = $5::vector,
            error_message = NULL,
            updated_at = now()
          WHERE id = $1
        `,
        [
          input.analysisId,
          input.analysis.priority,
          input.analysis.suggestedLabels.map((label) => label.name),
          JSON.stringify(input.analysis),
          toVectorLiteral(input.embedding)
        ]
      );

      for (const similarIssue of input.similarIssues) {
        await client.query(
          `
            INSERT INTO similar_issue_candidates (
              analysis_id,
              similar_issue_id,
              similarity,
              summary
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (analysis_id, similar_issue_id) DO UPDATE SET
              similarity = EXCLUDED.similarity,
              summary = EXCLUDED.summary
          `,
          [
            input.analysisId,
            similarIssue.issueId,
            similarIssue.similarity,
            similarIssue.summary
          ]
        );
      }
    });
  }

  public async failAnalysis(analysisId: string, error: unknown): Promise<void> {
    await this.database.query(
      `
        UPDATE triage_analyses
        SET status = 'failed',
            error_message = $2,
            updated_at = now()
        WHERE id = $1
      `,
      [analysisId, getErrorMessage(error)]
    );
  }

  public async findSimilarIssues(input: {
    repositoryId: string;
    issueId: string;
    embedding: number[];
    limit: number;
  }): Promise<SimilarIssue[]> {
    const result = await this.database.query<{
      issue_id: string;
      issue_number: number;
      title: string;
      state: "open" | "closed";
      html_url: string;
      similarity: number;
      summary: string | null;
    }>(
      `
        SELECT
          i.id AS issue_id,
          i.number AS issue_number,
          i.title,
          i.state,
          i.html_url,
          greatest(0, 1 - latest.distance)::float AS similarity,
          latest.analysis->>'summary' AS summary
        FROM issues i
        JOIN LATERAL (
          SELECT
            ta.analysis,
            ta.embedding <=> $3::vector AS distance
          FROM triage_analyses ta
          WHERE ta.issue_id = i.id
            AND ta.status = 'completed'
            AND ta.embedding IS NOT NULL
          ORDER BY ta.created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE i.repository_id = $1
          AND i.id <> $2
        ORDER BY latest.distance ASC
        LIMIT $4
      `,
      [
        input.repositoryId,
        input.issueId,
        toVectorLiteral(input.embedding),
        input.limit
      ]
    );

    return result.rows.map((row) => ({
      issueId: row.issue_id,
      issueNumber: row.issue_number,
      title: row.title,
      state: row.state,
      htmlUrl: row.html_url,
      similarity: row.similarity,
      summary: row.summary
    }));
  }

  public async getLatestAnalysis(issueId: string): Promise<TriageAnalysis | null> {
    const result = await this.database.query<TriageAnalysisRow>(
      `
        SELECT
          id,
          issue_id,
          status,
          model,
          embedding_model,
          analysis,
          error_message,
          created_at
        FROM triage_analyses
        WHERE issue_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [issueId]
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    const similarIssues = await this.getSimilarCandidates(row.id);
    return mapTriageAnalysis(row, similarIssues);
  }

  public async getAnalysisForIssue(
    issueId: string,
    analysisId: string
  ): Promise<TriageAnalysis> {
    const result = await this.database.query<TriageAnalysisRow>(
      `
        SELECT
          id,
          issue_id,
          status,
          model,
          embedding_model,
          analysis,
          error_message,
          created_at
        FROM triage_analyses
        WHERE id = $1
          AND issue_id = $2
      `,
      [analysisId, issueId]
    );
    const row = result.rows[0];

    if (!row) {
      throw notFound("Triage analysis not found");
    }

    return mapTriageAnalysis(row, await this.getSimilarCandidates(row.id));
  }

  public async createApproval(input: {
    issueId: string;
    analysisId: string;
    userId: string;
    labels: string[];
    comment: string | null;
  }): Promise<string> {
    const result = await this.database.query<{ id: string }>(
      `
        INSERT INTO issue_approvals (
          issue_id,
          analysis_id,
          user_id,
          status,
          approved_labels,
          approved_comment
        )
        VALUES ($1, $2, $3, 'approved', $4, $5)
        RETURNING id
      `,
      [
        input.issueId,
        input.analysisId,
        input.userId,
        input.labels,
        input.comment
      ]
    );

    return requireRow(result.rows[0]).id;
  }

  public async hasAppliedApprovalForAnalysis(input: {
    issueId: string;
    analysisId: string;
  }): Promise<boolean> {
    const result = await this.database.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM issue_approvals
          WHERE issue_id = $1
            AND analysis_id = $2
            AND status = 'applied'
        )
      `,
      [input.issueId, input.analysisId]
    );

    return requireRow(result.rows[0]).exists;
  }


  public async markApprovalApplied(
    approvalId: string,
    githubCommentId: number | null
  ): Promise<void> {
    await this.database.query(
      `
        UPDATE issue_approvals
        SET status = 'applied',
            github_comment_id = $2,
            applied_at = now(),
            error_message = NULL
        WHERE id = $1
      `,
      [approvalId, githubCommentId]
    );
  }

  public async markApprovalFailed(
    approvalId: string,
    error: unknown
  ): Promise<void> {
    await this.database.query(
      `
        UPDATE issue_approvals
        SET status = 'failed',
            error_message = $2
        WHERE id = $1
      `,
      [approvalId, getErrorMessage(error)]
    );
  }

  private async getSimilarCandidates(analysisId: string): Promise<SimilarIssue[]> {
    const result = await this.database.query<{
      issue_id: string;
      issue_number: number;
      title: string;
      state: "open" | "closed";
      html_url: string;
      similarity: number;
      summary: string | null;
    }>(
      `
        SELECT
          i.id AS issue_id,
          i.number AS issue_number,
          i.title,
          i.state,
          i.html_url,
          sic.similarity::float AS similarity,
          sic.summary
        FROM similar_issue_candidates sic
        JOIN issues i ON i.id = sic.similar_issue_id
        WHERE sic.analysis_id = $1
        ORDER BY sic.similarity DESC
      `,
      [analysisId]
    );

    return result.rows.map((row) => ({
      issueId: row.issue_id,
      issueNumber: row.issue_number,
      title: row.title,
      state: row.state,
      htmlUrl: row.html_url,
      similarity: row.similarity,
      summary: row.summary
    }));
  }

  private async getApprovals(issueId: string) {
    const result = await this.database.query<{
      id: string;
      analysis_id: string;
      status: "approved" | "applied" | "failed";
      approved_labels: string[];
      approved_comment: string | null;
      error_message: string | null;
      created_at: Date;
      applied_at: Date | null;
    }>(
      `
        SELECT
          id,
          analysis_id,
          status,
          approved_labels,
          approved_comment,
          error_message,
          created_at,
          applied_at
        FROM issue_approvals
        WHERE issue_id = $1
        ORDER BY created_at DESC
      `,
      [issueId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      analysisId: row.analysis_id,
      status: row.status,
      approvedLabels: row.approved_labels,
      approvedComment: row.approved_comment,
      errorMessage: row.error_message,
      createdAt: row.created_at.toISOString(),
      appliedAt: row.applied_at?.toISOString() ?? null
    }));
  }
}

function mapIssueListItem(row: IssueListRow): IssueListItem {
  return issueListItemSchema.parse({
    id: row.id,
    repositoryId: row.repository_id,
    number: row.number,
    title: row.title,
    state: row.state,
    authorLogin: row.author_login,
    labels: row.label_names,
    priority: row.priority,
    analysisStatus: row.analysis_status,
    htmlUrl: row.html_url,
    githubCreatedAt: row.github_created_at.toISOString(),
    githubUpdatedAt: row.github_updated_at.toISOString()
  });
}

function mapTriageAnalysis(
  row: TriageAnalysisRow,
  similarIssues: SimilarIssue[]
): TriageAnalysis {
  return triageAnalysisSchema.parse({
    id: row.id,
    issueId: row.issue_id,
    status: row.status,
    model: row.model,
    embeddingModel: row.embedding_model,
    analysis: row.analysis,
    similarIssues,
    errorMessage: row.error_message,
    createdAt: row.created_at.toISOString()
  });
}

function normalizeRepositoryJson(repository: unknown): unknown {
  if (!repository || typeof repository !== "object") {
    return repository;
  }

  const value = repository as Record<string, unknown>;

  return {
    ...value,
    connectedAt: toIso(value.connectedAt),
    updatedAt: toIso(value.updatedAt)
  };
}

function toIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function toVectorLiteral(embedding: number[]): string {
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding contains a non-finite value");
  }

  return `[${embedding.join(",")}]`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requireRow<T>(row: T | undefined): T {
  if (!row) {
    throw new Error("Expected database row");
  }

  return row;
}

export function assertIssueIsOwned(issue: IssueForApproval | null): IssueForApproval {
  if (!issue) {
    throw forbidden();
  }

  return issue;
}
