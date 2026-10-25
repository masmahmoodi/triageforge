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

const lockfile = readFileSync(resolve(repoRoot, "pnpm-lock.yaml"), "utf8");

describe("dependency security pins (pnpm-lock.yaml)", () => {
  it("resolves zod to the CVE-fixed 4.6.6", () => {
    expect(lockfile).toMatch(/zod@4\.6\.6:/);
    expect(lockfile).not.toMatch(/zod@4\.4\.3/);
  });

  it("resolves body-parser to the CVE-fixed 2.4.0", () => {
    expect(lockfile).toMatch(/body-parser@2\.4\.0:/);
    expect(lockfile).not.toMatch(/body-parser@2\.3\.0/);
  });
});
