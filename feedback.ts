/** Signal Library design: local-only feedback ledger for the static review desk; no fabricated records or server persistence. */
export type FeedbackRating = "up" | "down";
export type FeedbackSentiment = "positive" | "neutral" | "negative";
export type FeedbackReviewStatus = "new" | "investigating" | "resolved";
export type FeedbackIssueCategory = "none" | "inaccurate" | "missing_detail" | "unclear" | "outdated" | "other";

export type FeedbackRecord = {
  id: string;
  question: string;
  answer: string;
  rating: FeedbackRating;
  comment: string;
  sentiment: FeedbackSentiment;
  sentimentSource: "ai" | "fallback";
  updatedAt: string;
  issueCategory: FeedbackIssueCategory;
  reviewStatus: FeedbackReviewStatus;
  reviewerNote: string;
  pinned: boolean;
  reviewedAt?: string;
  alertedAt?: string;
};

const RECORDS_KEY = "signal-library-feedback-records";

function normalizeRecord(record: Partial<FeedbackRecord> & Pick<FeedbackRecord, "id" | "question" | "answer" | "rating" | "comment" | "updatedAt">): FeedbackRecord {
  return {
    ...record,
    issueCategory: record.issueCategory ?? "none",
    sentiment: record.sentiment ?? "neutral",
    sentimentSource: record.sentimentSource ?? "fallback",
    reviewStatus: record.reviewStatus ?? (record.rating === "down" ? "new" : "resolved"),
    reviewerNote: record.reviewerNote ?? "",
    pinned: record.pinned ?? false,
  };
}

export function getFeedbackRecords(): FeedbackRecord[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECORDS_KEY) ?? "[]") as FeedbackRecord[];
    return Array.isArray(parsed) ? parsed.map(normalizeRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  } catch {
    return [];
  }
}

export function upsertFeedbackRecord(record: Omit<FeedbackRecord, "id" | "updatedAt" | "issueCategory" | "reviewStatus" | "reviewerNote" | "pinned" | "reviewedAt">) {
  const records = getFeedbackRecords();
  const id = `feedback:${record.question}`;
  const existing = records.find((item) => item.id === id);
  const nextRecord: FeedbackRecord = {
    ...record,
    id,
    updatedAt: new Date().toISOString(),
    issueCategory: existing?.issueCategory ?? "none",
    sentiment: existing?.sentiment ?? (record.rating === "up" ? "positive" : "negative"),
    sentimentSource: existing?.sentimentSource ?? "fallback",
    reviewStatus: existing?.reviewStatus ?? (record.rating === "down" ? "new" : "resolved"),
    reviewerNote: existing?.reviewerNote ?? "",
    pinned: existing?.pinned ?? false,
    reviewedAt: existing?.reviewedAt,
  };
  const existingIndex = records.findIndex((item) => item.id === id);
  if (existingIndex >= 0) records[existingIndex] = nextRecord;
  else records.push(nextRecord);
  window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function updateFeedbackReview(id: string, updates: Pick<Partial<FeedbackRecord>, "issueCategory" | "reviewStatus" | "reviewerNote" | "pinned">) {
  const records = getFeedbackRecords().map((record) => record.id === id ? {
    ...record,
    ...updates,
    reviewedAt: new Date().toISOString(),
  } : record);
  window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  return records;
}
