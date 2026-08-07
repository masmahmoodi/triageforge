import { createHmac } from "node:crypto";

import {
  describe,
  expect,
  it
} from "vitest";

import { verifyGitHubSignature } from "../src/modules/github/webhook-signature.js";

describe("verifyGitHubSignature", () => {
  it("accepts valid sha256 webhook signatures", () => {
    const secret = "webhook-secret";
    const rawBody = Buffer.from(JSON.stringify({ action: "opened" }));
    const signature = `sha256=${createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex")}`;

    expect(
      verifyGitHubSignature({
        secret,
        rawBody,
        signatureHeader: signature
      })
    ).toBe(true);
  });

  it("rejects invalid signatures", () => {
    expect(
      verifyGitHubSignature({
        secret: "webhook-secret",
        rawBody: Buffer.from("{}"),
        signatureHeader: "sha256=bad"
      })
    ).toBe(false);
  });
});
