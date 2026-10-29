import { describe, expect, it } from "vitest";
import { feedbackEntries } from "../drizzle/schema";
import { feedbackRouter } from "./feedback";

describe("centralized feedback review surface", () => {
  it("defines the durable fields required for secure review workflows", () => {
    expect(feedbackEntries.publicId.name).toBe("publicId");
    expect(feedbackEntries.reviewStatus.name).toBe("reviewStatus");
    expect(feedbackEntries.issueCategory.name).toBe("issueCategory");
    expect(feedbackEntries.reviewerNote.name).toBe("reviewerNote");
    expect(feedbackEntries.alertedAt.name).toBe("alertedAt");
    expect(feedbackEntries.sentiment.name).toBe("sentiment");
    expect(feedbackEntries.sentimentSource.name).toBe("sentimentSource");
  });

  it("exposes the shared submission, protected review, and alert summary procedures", () => {
    const procedures = feedbackRouter._def.procedures;
    expect(Object.keys(procedures).sort()).toEqual(["alertSummary", "exportCsv", "list", "report", "submit", "updateReview"]);
  });
});
