import {
  describe,
  expect,
  it
} from "vitest";

import {
  hashPassword,
  verifyPassword
} from "../src/infrastructure/security/password.js";

describe("password hashing", () => {
  it("verifies a matching password and rejects a different one", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(
      verifyPassword("correct horse battery staple", hash)
    ).resolves.toBe(true);
    await expect(verifyPassword("incorrect", hash)).resolves.toBe(false);
    expect(hash).not.toContain("correct horse battery staple");
  });
});
