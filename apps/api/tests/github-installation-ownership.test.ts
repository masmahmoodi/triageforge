import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../src/config/env.js";
import type { Database } from "../src/infrastructure/database/database.js";
import { GitHubAppService } from "../src/modules/github/github-app-service.js";
import type { IssueRepository } from "../src/modules/issues/issue-repository.js";

describe("GitHub installation ownership", () => {
  it("refuses to connect an installation owned by another user", async () => {
    const stateClient = {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] })
    };
    const database = {
      transaction: vi.fn(async (callback) => callback(stateClient)),
      query: vi.fn().mockResolvedValue({
        rows: [{
          user_id: "original-user-id",
          account_login: "repository-owner"
        }]
      })
    } as unknown as Database;
    const issueRepository = {} as IssueRepository;
    const service = new GitHubAppService(
      database,
      issueRepository,
      loadConfig({ NODE_ENV: "test" })
    );

    await expect(service.handleCallback({
      userId: "different-user-id",
      installationId: 12345,
      state: "valid-state"
    })).rejects.toMatchObject({
      code: "forbidden",
      statusCode: 403
    });

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE installation_id = $1"),
      [12345]
    );
  });
});
