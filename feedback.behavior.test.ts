import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const listFeedbackEntries = vi.fn(async () => []);
const notifyOwner = vi.fn(async () => false);

vi.mock("./db", () => ({
  createFeedbackEntry: vi.fn(),
  getFeedbackEntryByPublicId: vi.fn(),
  listFeedbackEntries,
  updateFeedbackEntry: vi.fn(),
}));

vi.mock("./_core/notification", () => ({ notifyOwner }));

const { feedbackRouter } = await import("./feedback");

function adminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "review-desk-admin",
      name: "Review Desk Admin",
      email: null,
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      lastSignedIn: new Date(0),
    },
  } as TrpcContext;
}

describe("protected shared feedback reporting", () => {
  it("returns a secure empty report and zero operational metrics without seeded feedback", async () => {
    const caller = feedbackRouter.createCaller(adminContext());
    const report = await caller.report({ savedView: "all", sortBy: "newest", sentiment: "neutral" });

    expect(report).toEqual({
      records: [],
      total: 0,
      metrics: { positive: 0, negative: 0, unresolved: 0, resolved: 0, commented: 0, resolutionRate: 0 },
    });
    expect(listFeedbackEntries).toHaveBeenCalledOnce();

    await expect(caller.report({ savedView: "all", sortBy: "newest", sentiment: "positive" })).resolves.toMatchObject({ records: [], total: 0 });
  });

  it("generates a shared CSV header and keeps the alert path dormant when no feedback exists", async () => {
    const caller = feedbackRouter.createCaller(adminContext());
    const exported = await caller.exportCsv({ savedView: "all", sortBy: "newest" });
    const alerts = await caller.alertSummary();

    expect(exported.count).toBe(0);
    expect(exported.csv).toContain("\"captured_at\"");
    expect(exported.csv).toContain("\"sentiment\"");
    expect(exported.csv).toContain("\"sentiment_source\"");
    expect(exported.csv).toContain("\"owner_alerted_at\"");
    expect(alerts).toEqual({ totalFlagged: 0, unresolved: 0, unalerted: 0 });
    expect(notifyOwner).not.toHaveBeenCalled();
  });
});
