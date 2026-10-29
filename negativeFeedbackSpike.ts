export type NegativeFeedbackPeriod = {
  label: string;
  positive: number;
  negative: number;
};

export type TimestampedNegativeFeedbackPeriod = NegativeFeedbackPeriod & {
  observedAt: string;
};

export type NegativeFeedbackSpike =
  | { state: "insufficient_history"; periodCount: number }
  | { state: "stable"; latestLabel: string; latestNegative: number; latestTotal: number; latestRate: number; baselineRate: number; change: number }
  | { state: "spike"; latestLabel: string; latestNegative: number; latestTotal: number; latestRate: number; baselineRate: number; change: number };

export type NegativeFeedbackSpikeHistoryItem = Extract<NegativeFeedbackSpike, { state: "spike" }> & {
  observedAt: string;
};

const MINIMUM_LATEST_RECORDS = 3;
const MINIMUM_LATEST_NEGATIVE = 2;
const MINIMUM_NEGATIVE_RATE = 50;
const MINIMUM_RATE_INCREASE = 25;

export type NegativeFeedbackSpikeOptions = {
  comparisonWindowPeriods?: number;
  retentionWindowPeriods?: number;
};

export function detectNegativeFeedbackSpike(periods: NegativeFeedbackPeriod[], options: NegativeFeedbackSpikeOptions = {}): NegativeFeedbackSpike {
  const comparisonWindowPeriods = Math.max(1, options.comparisonWindowPeriods ?? 2);
  if (periods.length < comparisonWindowPeriods + 1) {
    return { state: "insufficient_history", periodCount: periods.length };
  }

  const latest = periods.at(-1)!;
  const baselinePeriods = periods.slice(-(comparisonWindowPeriods + 1), -1);
  const baselineNegative = baselinePeriods.reduce((total, period) => total + period.negative, 0);
  const baselineTotal = baselinePeriods.reduce((total, period) => total + period.positive + period.negative, 0);
  const latestTotal = latest.positive + latest.negative;
  const baselineRate = baselineTotal ? Math.round((baselineNegative / baselineTotal) * 100) : 0;
  const latestRate = latestTotal ? Math.round((latest.negative / latestTotal) * 100) : 0;
  const change = latestRate - baselineRate;
  const state = latestTotal >= MINIMUM_LATEST_RECORDS
    && latest.negative >= MINIMUM_LATEST_NEGATIVE
    && latestRate >= MINIMUM_NEGATIVE_RATE
    && change >= MINIMUM_RATE_INCREASE
    ? "spike"
    : "stable";

  return {
    state,
    latestLabel: latest.label,
    latestNegative: latest.negative,
    latestTotal,
    latestRate,
    baselineRate,
    change,
  };
}

export function getNegativeFeedbackSpikeHistory(periods: TimestampedNegativeFeedbackPeriod[], options: NegativeFeedbackSpikeOptions = {}): NegativeFeedbackSpikeHistoryItem[] {
  const retentionWindowPeriods = Math.max(1, options.retentionWindowPeriods ?? periods.length);
  const firstRetainedIndex = Math.max(0, periods.length - retentionWindowPeriods);
  return periods.flatMap((period, index) => {
    if (index < firstRetainedIndex) return [];
    const result = detectNegativeFeedbackSpike(periods.slice(0, index + 1), options);
    return result.state === "spike" ? [{ ...result, observedAt: period.observedAt }] : [];
  }).reverse();
}
