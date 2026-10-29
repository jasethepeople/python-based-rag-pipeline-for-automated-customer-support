/** @vitest-environment jsdom */
import React, { useMemo, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_NEGATIVE_FEEDBACK_ALERT_SETTINGS, type NegativeFeedbackAlertSettings } from "@/lib/negativeFeedbackAlertSettings";
import { detectNegativeFeedbackSpike } from "@/lib/negativeFeedbackSpike";
import { NegativeFeedbackAlertSettingsPanel } from "./NegativeFeedbackAlertSettingsPanel";

const aggregatePeriods = [
  { label: "One", positive: 8, negative: 2 },
  { label: "Two", positive: 9, negative: 1 },
  { label: "Three", positive: 9, negative: 1 },
  { label: "Four", positive: 1, negative: 3 },
];

function SettingsHarness() {
  const [settings, setSettings] = useState<NegativeFeedbackAlertSettings>(DEFAULT_NEGATIVE_FEEDBACK_ALERT_SETTINGS);
  const analysis = useMemo(() => detectNegativeFeedbackSpike(aggregatePeriods, settings), [settings]);
  const baseline = analysis.state === "insufficient_history" ? "calibrating" : analysis.baselineRate;
  return <><NegativeFeedbackAlertSettingsPanel settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_NEGATIVE_FEEDBACK_ALERT_SETTINGS)} /><output aria-label="Current alert analysis">baseline {baseline}; retention {settings.retentionWindowPeriods}</output></>;
}

describe("NegativeFeedbackAlertSettingsPanel", () => {
  it("updates configurable analysis windows and restores documented defaults", () => {
    render(<SettingsHarness />);
    const comparison = screen.getByRole("combobox", { name: /comparison window/i }) as HTMLSelectElement;
    const retention = screen.getByRole("combobox", { name: /history retention/i }) as HTMLSelectElement;

    expect(comparison.value).toBe("2");
    expect(retention.value).toBe("6");
    expect(screen.getByLabelText("Current alert analysis").textContent).toContain("baseline 10; retention 6");

    fireEvent.change(comparison, { target: { value: "3" } });
    fireEvent.change(retention, { target: { value: "12" } });
    expect(screen.getByLabelText("Current alert analysis").textContent).toContain("baseline 13; retention 12");

    fireEvent.click(screen.getByRole("button", { name: "Reset defaults" }));
    expect(comparison.value).toBe("2");
    expect(retention.value).toBe("6");
    expect(screen.getByLabelText("Current alert analysis").textContent).toContain("baseline 10; retention 6");
  });
});
