import React from "react";
import { COMPARISON_WINDOW_OPTIONS, RETENTION_WINDOW_OPTIONS, type NegativeFeedbackAlertSettings } from "@/lib/negativeFeedbackAlertSettings";

type NegativeFeedbackAlertSettingsPanelProps = {
  settings: NegativeFeedbackAlertSettings;
  onChange: (settings: NegativeFeedbackAlertSettings) => void;
  onReset: () => void;
};

export function NegativeFeedbackAlertSettingsPanel({ settings, onChange, onReset }: NegativeFeedbackAlertSettingsPanelProps) {
  return (
    <section className="negative-spike-settings" aria-labelledby="negative-spike-settings-title">
      <div className="negative-spike-settings-heading"><div><span className="section-number">Alert settings</span><div><h2 id="negative-spike-settings-title">Spike monitor preferences</h2><p>Saved in this browser. These settings adjust dashboard analysis, not stored feedback.</p></div></div><button type="button" onClick={onReset}>Reset defaults</button></div>
      <div className="negative-spike-settings-controls"><label htmlFor="negative-spike-comparison-window">Comparison window<select id="negative-spike-comparison-window" value={settings.comparisonWindowPeriods} onChange={(event) => onChange({ ...settings, comparisonWindowPeriods: Number(event.target.value) as NegativeFeedbackAlertSettings["comparisonWindowPeriods"] })}>{COMPARISON_WINDOW_OPTIONS.map((periods) => <option key={periods} value={periods}>{periods} prior periods</option>)}</select><small>Baseline used to evaluate the newest period.</small></label><label htmlFor="negative-spike-retention-window">History retention<select id="negative-spike-retention-window" value={settings.retentionWindowPeriods} onChange={(event) => onChange({ ...settings, retentionWindowPeriods: Number(event.target.value) as NegativeFeedbackAlertSettings["retentionWindowPeriods"] })}>{RETENTION_WINDOW_OPTIONS.map((periods) => <option key={periods} value={periods}>{periods} recent periods</option>)}</select><small>Maximum analysis window shown in the alert log.</small></label></div>
    </section>
  );
}
