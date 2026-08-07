import {
  describe,
  expect,
  it
} from "vitest";

import { shouldQueueTriageForIssueAction } from "../src/modules/github/webhook-service.js";

describe("shouldQueueTriageForIssueAction", () => {
  it.each(["opened", "edited", "reopened", "transferred"])(
    "queues triage for %s issue events",
    (action) => {
      expect(shouldQueueTriageForIssueAction(action)).toBe(true);
    }
  );

  it.each([
    "assigned",
    "closed",
    "demilestoned",
    "labeled",
    "locked",
    "milestoned",
    "unassigned",
    "unlabeled",
    "unlocked"
  ])("does not queue triage for %s issue events", (action) => {
    expect(shouldQueueTriageForIssueAction(action)).toBe(false);
  });
});
