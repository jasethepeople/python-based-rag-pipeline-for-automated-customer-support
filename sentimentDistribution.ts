import type { FeedbackRecord, FeedbackSentiment } from "./feedback";

export type SentimentDistributionItem = {
  sentiment: FeedbackSentiment;
  label: string;
  count: number;
  percentage: number;
};

const sentimentOrder: FeedbackSentiment[] = ["positive", "neutral", "negative"];

const sentimentLabels: Record<FeedbackSentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export function getSentimentDistribution(records: Pick<FeedbackRecord, "sentiment">[]): SentimentDistributionItem[] {
  const total = records.length;
  return sentimentOrder.map((sentiment) => {
    const count = records.filter((record) => record.sentiment === sentiment).length;
    return {
      sentiment,
      label: sentimentLabels[sentiment],
      count,
      percentage: total ? Math.round((count / total) * 100) : 0,
    };
  });
}
