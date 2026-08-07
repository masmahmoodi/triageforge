import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../infrastructure/database/database.js";
import { randomToken, sha256 } from "../../infrastructure/security/hash.js";
import { badRequest, forbidden, notFound } from "../../shared/errors.js";
import type { IssueRepository } from "../issues/issue-repository.js";
import { GitHubClient, type GitHubRepository } from "./github-client.js";

interface InstallationRow {
  id: string;
  installation_id: string;
  account_login: string;
  account_type: string;
  target_type: string | null;
  suspended_at: Date | null;
  updated_at: Date;
}

export class GitHubAppService {
  private readonly githubClient: GitHubClient;

  public constructor(
    private readonly database: Database,
    private readonly issueRepository: IssueRepository,
    private readonly config: AppConfig
  ) {
    this.githubClient = new GitHubClient(config.github);
  }

  public async createSetupUrl(userId: string): Promise<string> {
    const state = randomToken();
    const stateHash = sha256(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.database.query(
      `
        INSERT INTO github_app_states (state_hash, user_id, expires_at)
        VALUES ($1, $2, $3)
      `,
      [stateHash, userId, expiresAt]
    );

    return this.githubClient.getSetupUrl(state);
  }

  public async handleCallback(input: {
    userId: string;
    installationId: number;
    state: string;
  }): Promise<void> {
    await this.database.transaction(async (client) => {
      const result = await client.query<{ state_hash: string }>(
        `
          UPDATE github_app_states
          SET used_at = now()
          WHERE state_hash = $1
            AND user_id = $2
            AND used_at IS NULL
            AND expires_at > now()
          RETURNING state_hash
        `,
        [sha256(input.state), input.userId]
      );

      if (result.rowCount === 0) {
        throw badRequest("GitHub installation state is invalid or expired");
      }
    });

    await this.assertInstallationCanBeConnected(
      input.userId,
      input.installationId
    );

    const installation = await this.githubClient.getInstallation(
      input.installationId
    );
    const repositories = await this.githubClient.listInstallationRepositories(
      input.installationId
    );

    await this.database.transaction(async (client) => {
      const installationDatabaseId =
        await this.issueRepository.upsertInstallation(client, {
          userId: input.userId,
          ...installation
        });

      for (const repository of repositories) {
        await this.upsertRepository(client, installationDatabaseId, repository);
      }
    });
  }

  public async listInstallations(userId: string) {
    const result = await this.database.query<InstallationRow>(
      `
        SELECT
          id,
          installation_id,
          account_login,
          account_type,
          target_type,
          suspended_at,
          updated_at
        FROM github_installations
        WHERE user_id = $1
        ORDER BY account_login ASC
      `,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      installationId: row.installation_id,
      accountLogin: row.account_login,
      accountType: row.account_type,
      targetType: row.target_type,
      suspendedAt: row.suspended_at?.toISOString() ?? null,
      updatedAt: row.updated_at.toISOString()
    }));
  }

  public async syncInstallation(userId: string, installationDatabaseId: string) {
    const result = await this.database.query<{
      id: string;
      installation_id: string;
    }>(
      `
        SELECT id, installation_id
        FROM github_installations
        WHERE id = $1
          AND user_id = $2
      `,
      [installationDatabaseId, userId]
    );
    const installation = result.rows[0];

    if (!installation) {
      throw notFound("GitHub installation not found");
    }

    const githubInstallationId = Number(installation.installation_id);
    const installationDetails =
      await this.githubClient.getInstallation(githubInstallationId);
    const repositories =
      await this.githubClient.listInstallationRepositories(githubInstallationId);

    await this.database.transaction(async (client) => {
      const refreshedInstallationId =
        await this.issueRepository.upsertInstallation(client, {
          userId,
          ...installationDetails
        });

      if (refreshedInstallationId !== installation.id) {
        throw forbidden("GitHub installation ownership changed during sync");
      }

      for (const repository of repositories) {
        await this.upsertRepository(client, installation.id, repository);
      }
    });
  }

  private async upsertRepository(
    client: Parameters<IssueRepository["upsertRepository"]>[0],
    installationDatabaseId: string,
    repository: GitHubRepository
  ): Promise<void> {
    await this.issueRepository.upsertRepository(client, {
      installationDatabaseId,
      ...repository
    });
  }

  private async assertInstallationCanBeConnected(
    userId: string,
    installationId: number
  ): Promise<void> {
    const result = await this.database.query<{
      user_id: string | null;
      account_login: string;
    }>(
      `
        SELECT user_id, account_login
        FROM github_installations
        WHERE installation_id = $1
      `,
      [installationId]
    );
    const existingInstallation = result.rows[0];

    if (
      existingInstallation?.user_id &&
      existingInstallation.user_id !== userId
    ) {
      throw forbidden(
        `This GitHub installation is already connected to another TriageForge account. Log in with the original TriageForge account, or uninstall and reinstall the GitHub App for ${existingInstallation.account_login}.`
      );
    }
  }
}
