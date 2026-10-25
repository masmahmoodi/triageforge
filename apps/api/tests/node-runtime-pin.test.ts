import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  describe,
  expect,
  it
} from "vitest";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

describe("Node runtime security pin (.nvmrc)", () => {
  it("pins Node.js to the 2026-10 security release 24.22.1", () => {
    const pin = readFileSync(resolve(repoRoot, ".nvmrc"), "utf8").trim();
    expect(pin).toBe("24.22.1");
  });
});
