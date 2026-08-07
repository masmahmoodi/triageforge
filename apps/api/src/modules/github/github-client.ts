import { createSign } from "node:crypto";

import type { AppConfig } from "../../config/env.js";
import { integrationUnavailable } from "../../shared/errors.js";

interface GitHubInstallationResponse {
  id: number;
  account: {
    login: string;
    type: string;
  } | null;
  target_type?: string;
  permissions?: Record<string, string>;
  events?: string[];
  suspended_at?: string | null;
}

interface GitHubRepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string | null;
  html_url: string;
  owner: {
    login: string;
  };
}

export interface GitHubInstallation {
  installationId: number;
  accountLogin: string;
  accountType: string;
  targetType: string | null;
  permissions: Record<string, string>;
  events: string[];
  suspendedAt: string | null;
}

export interface GitHubRepository {
  githubId: number;
  ownerLogin: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string | null;
  htmlUrl: string;
}

export interface GitHubLabelInput {
  name: string;
  color: string;
  description?: string;
}

export class GitHubClient {
  public constructor(private readonly config: AppConfig["github"]) {}

  public getSetupUrl(state: string): string {
    if (!this.config.appSlug) {
      throw integrationUnavailable("GITHUB_APP_SLUG is required to build the GitHub App installation URL");
    }

    const url = new URL(
      `https://github.com/apps/${this.config.appSlug}/installations/new`
    );
    url.searchParams.set("state", state);
    return url.toString();
  }

  public async getInstallation(installationId: number): Promise<GitHubInstallation> {
    const response = await this.request<GitHubInstallationResponse>(
      `/app/installations/${installationId}`,
      {
        method: "GET",
        token: this.createAppJwt()
      }
    );

    if (!response.account) {
      throw new Error("GitHub installation response did not include an account");
    }

    return {
      installationId: response.id,
      accountLogin: response.account.login,
      accountType: response.account.type,
      targetType: response.target_type ?? null,
      permissions: response.permissions ?? {},
      events: response.events ?? [],
      suspendedAt: response.suspended_at ?? null
    };
  }

  public async listInstallationRepositories(
    installationId: number
  ): Promise<GitHubRepository[]> {
    const token = await this.createInstallationToken(installationId);
    const repositories: GitHubRepository[] = [];
    let path = "/installation/repositories?per_page=100";

    while (path) {
      const response = await this.request<{
        repositories: GitHubRepositoryResponse[];
      }>(path, {
        method: "GET",
        token
      });

      repositories.push(
        ...response.repositories.map((repository) => ({
          githubId: repository.id,
          ownerLogin: repository.owner.login,
          name: repository.name,
          fullName: repository.full_name,
          private: repository.private,
          defaultBranch: repository.default_branch,
          htmlUrl: repository.html_url
        }))
      );

      path = "";
    }

    return repositories;
  }

  public async ensureLabels(
    installationId: number,
    owner: string,
    repo: string,
    labels: GitHubLabelInput[]
  ): Promise<void> {
    const token = await this.createInstallationToken(installationId);

    for (const label of labels) {
      await this.request<unknown>(`/repos/${owner}/${repo}/labels`, {
        method: "POST",
        token,
        body: {
          name: label.name,
          color: label.color,
          description: label.description ?? "Suggested by TriageForge"
        },
        ignoreStatuses: [422]
      });
    }
  }

  public async addIssueLabels(input: {
    installationId: number;
    owner: string;
    repo: string;
    issueNumber: number;
    labels: string[];
  }): Promise<void> {
    if (input.labels.length === 0) {
      return;
    }

    const token = await this.createInstallationToken(input.installationId);
    await this.request<unknown>(
      `/repos/${input.owner}/${input.repo}/issues/${input.issueNumber}/labels`,
      {
        method: "POST",
        token,
        body: {
          labels: input.labels
        }
      }
    );
  }

  public async createIssueComment(input: {
    installationId: number;
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }): Promise<number | null> {
    const token = await this.createInstallationToken(input.installationId);
    const response = await this.request<{ id?: number }>(
      `/repos/${input.owner}/${input.repo}/issues/${input.issueNumber}/comments`,
      {
        method: "POST",
        token,
        body: {
          body: input.body
        }
      }
    );

    return response.id ?? null;
  }

  private async createInstallationToken(installationId: number): Promise<string> {
    const response = await this.request<{ token: string }>(
      `/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        token: this.createAppJwt()
      }
    );

    return response.token;
  }

  private createAppJwt(): string {
    if (!this.config.appId || !this.config.privateKey) {
      throw integrationUnavailable(
        "GITHUB_APP_ID and GITHUB_PRIVATE_KEY_BASE64 or GITHUB_PRIVATE_KEY are required for GitHub App API calls"
      );
    }

    const issuedAt = Math.floor(Date.now() / 1000) - 60;
    const expiresAt = issuedAt + 9 * 60;
    const header = base64UrlJson({
      alg: "RS256",
      typ: "JWT"
    });
    const payload = base64UrlJson({
      iat: issuedAt,
      exp: expiresAt,
      iss: this.config.appId
    });
    const signingInput = `${header}.${payload}`;
    const signature = createSign("RSA-SHA256")
      .update(signingInput)
      .sign(this.config.privateKey, "base64url");

    return `${signingInput}.${signature}`;
  }

  private async request<T>(
    path: string,
    options: {
      method: string;
      token: string;
      body?: unknown;
      ignoreStatuses?: number[];
    }
  ): Promise<T> {
    const requestInit: RequestInit = {
      method: options.method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
        "User-Agent": "TriageForge",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    };

    if (options.body) {
      requestInit.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.config.apiBaseUrl}${path}`, requestInit);

    if (options.ignoreStatuses?.includes(response.status)) {
      return undefined as T;
    }

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `GitHub API ${options.method} ${path} failed with ${response.status}: ${responseText}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
