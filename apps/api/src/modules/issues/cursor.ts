import { badRequest } from "../../shared/errors.js";

export interface IssueCursor {
  githubUpdatedAt: string;
  id: string;
}

export function encodeIssueCursor(cursor: IssueCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeIssueCursor(cursor: string | undefined): IssueCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as
      | IssueCursor
      | undefined;

    if (!parsed?.githubUpdatedAt || !parsed.id) {
      throw new Error("Invalid cursor shape");
    }

    return parsed;
  } catch {
    throw badRequest("Cursor is invalid");
  }
}
