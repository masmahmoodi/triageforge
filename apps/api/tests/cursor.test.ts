import {
  describe,
  expect,
  it
} from "vitest";

import {
  decodeIssueCursor,
  encodeIssueCursor
} from "../src/modules/issues/cursor.js";
import { HttpError } from "../src/shared/errors.js";

describe("issue cursors", () => {
  it("round trips cursor payloads", () => {
    const cursor = {
      githubUpdatedAt: "2026-08-06T12:00:00.000Z",
      id: "6a8b36c6-6584-4e2c-bc80-d964f7fb4d15"
    };

    expect(decodeIssueCursor(encodeIssueCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeIssueCursor("not-a-cursor")).toThrow(HttpError);
  });
});
