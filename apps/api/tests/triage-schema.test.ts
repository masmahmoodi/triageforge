import {
  describe,
  expect,
  it
} from "vitest";

import { aiIssueAnalysisSchema } from "@triageforge/contracts";

describe("aiIssueAnalysisSchema", () => {
  it("validates structured triage output", () => {
    expect(
      aiIssueAnalysisSchema.parse({
        summary: "A user reports that login fails after changing email.",
        category: "bug",
        priority: "high",
        confidence: 0.87,
        userImpact: "Affected users cannot access their accounts.",
        suggestedLabels: [
          {
            name: "bug",
            rationale: "The report describes a failing existing workflow.",
            color: null
          }
        ],
        missingInformation: ["Browser and account state"],
        draftResponse: "Thanks for the report. Could you share the browser and the exact error?",
        rationale: "Authentication failures block core product access.",
        needsHumanReview: true
      })
    ).toMatchObject({
      priority: "high",
      category: "bug"
    });
  });
});
