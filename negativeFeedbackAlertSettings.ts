export const COMPARISON_WINDOW_OPTIONS = [2, 3, 4] as const;
export const RETENTION_WINDOW_OPTIONS = [3, 6, 12] as const;

export type NegativeFeedbackAlertSettings = {
  comparisonWindowPeriods: (typeof COMPARISON_WINDOW_OPTIONS)[number];
  retentionWindowPeriods: (typeof RETENTION_WINDOW_OPTIONS)[number];
};

export const DEFAULT_NEGATIVE_FEEDBACK_ALERT_SETTINGS: NegativeFeedbackAlertSettings = {
  comparisonWindowPeriods: 2,
  retentionWindowPeriods: 6,
};

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

export function normalizeNegativeFeedbackAlertSettings(input: Partial<NegativeFeedbackAlertSettings> | null | undefined): NegativeFeedbackAlertSettings {
  const comparisonWindowPeriods = COMPARISON_WINDOW_OPTIONS.includes(input?.comparisonWindowPeriods as (typeof COMPARISON_WINDOW_OPTIONS)[number])
    ? input!.comparisonWindowPeriods as NegativeFeedbackAlertSettings["comparisonWindowPeriods"]
    : DEFAULT_NEGATIVE_FEEDBACK_ALERT_SETTINGS.comparisonWindowPeriods;
  const retentionWindowPeriods = RETENTION_WINDOW_OPTIONS.includes(input?.retentionWindowPeriods as (typeof RETENTION_WINDOW_OPTIONS)[number])
    ? input!.retentionWindowPeriods as NegativeFeedbackAlertSettings["retentionWindowPeriods"]
    : DEFAULT_NEGATIVE_FEEDBACK_ALERT_SETTINGS.retentionWindowPeriods;
  return { comparisonWindowPeriods, retentionWindowPeriods };
}

export function readNegativeFeedbackAlertSettings(storage: SettingsStorage, key: string): NegativeFeedbackAlertSettings {
  try {
    return normalizeNegativeFeedbackAlertSettings(JSON.parse(storage.getItem(key) ?? "{}") as Partial<NegativeFeedbackAlertSettings>);
  } catch {
    return DEFAULT_NEGATIVE_FEEDBACK_ALERT_SETTINGS;
  }
}

export function writeNegativeFeedbackAlertSettings(storage: SettingsStorage, key: string, settings: NegativeFeedbackAlertSettings) {
  storage.setItem(key, JSON.stringify(normalizeNegativeFeedbackAlertSettings(settings)));
}
