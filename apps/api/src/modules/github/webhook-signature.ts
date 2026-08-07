import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGitHubSignature(input: {
  secret: string;
  rawBody: Buffer;
  signatureHeader: string | undefined;
}): boolean {
  if (!input.signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", input.secret)
    .update(input.rawBody)
    .digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(input.signatureHeader);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
