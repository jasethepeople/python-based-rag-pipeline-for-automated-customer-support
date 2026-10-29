import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NegativeFeedbackSpikeMonitor } from "./NegativeFeedbackSpikeMonitor";

describe("NegativeFeedbackSpikeMonitor", () => {
  it("renders a non-alert stable monitor state from aggregate feedback-period values", () => {
    const markup = renderToStaticMarkup(<NegativeFeedbackSpikeMonitor isComparable spike={{ state: "stable", latestLabel: "Week of May 4", latestNegative: 1, latestTotal: 5, latestRate: 20, baselineRate: 18, change: 2 }} />);

    expect(markup).toContain('role="status"');
    expect(markup).toContain("No material negative-feedback spike");
    expect(markup).toContain("signals are negative (20%)");
  });

  it("renders a visually distinct assertive alert when the aggregate spike threshold is met", () => {
    const markup = renderToStaticMarkup(<NegativeFeedbackSpikeMonitor isComparable spike={{ state: "spike", latestLabel: "Week of May 11", latestNegative: 3, latestTotal: 4, latestRate: 75, baselineRate: 15, change: 60 }} />);

    expect(markup).toContain('negative-spike-monitor spike');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Negative-feedback spike detected in Week of May 11");
    expect(markup).toContain("up 60 points");
  });
});
