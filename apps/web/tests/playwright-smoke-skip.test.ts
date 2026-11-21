import { afterEach, describe, expect, it, vi } from "vitest";

const recorded = vi.hoisted(() => ({
  skipCalls: [] as unknown[][],
  tests: [] as unknown[][]
}));

vi.mock("@playwright/test", () => {
  const test = (...args: unknown[]): void => {
    recorded.tests.push(args);
  };

  test.skip = (...args: unknown[]): void => {
    recorded.skipCalls.push(args);
  };

  const expect = (): { toBeVisible: () => Promise<void> } => ({
    toBeVisible: (): Promise<void> => Promise.resolve()
  });

  return { expect, test };
});

describe("Playwright smoke test skip guard", () => {
  const originalBaseUrl = process.env.E2E_BASE_URL;

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.E2E_BASE_URL;
    } else {
      process.env.E2E_BASE_URL = originalBaseUrl;
    }
  });

  it("declares the skip with a description only when E2E_BASE_URL is unset", async () => {
    delete process.env.E2E_BASE_URL;
    recorded.skipCalls.length = 0;
    recorded.tests.length = 0;
    vi.resetModules();

    await import("../e2e/smoke.spec");

    expect(recorded.tests).toHaveLength(1);
    expect(recorded.skipCalls).toHaveLength(1);
    expect(recorded.skipCalls[0]).toHaveLength(1);
    expect(recorded.skipCalls[0]?.[0]).toEqual(expect.any(String));
  });
});