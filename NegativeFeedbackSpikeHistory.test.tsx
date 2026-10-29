import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NegativeFeedbackSpikeHistory } from "./NegativeFeedbackSpikeHistory";

describe("NegativeFeedbackSpikeHistory", () => {
  it("renders an honest empty history without inventing past alerts", () => {
    const markup = renderToStaticMarkup(<NegativeFeedbackSpikeHistory isComparable spikes={[]} />);

    expect(markup).toContain("No prior spike alerts in this view");
    expect(markup).toContain("0 alerts");
  });

  it("renders timestamped historical spike entries from aggregate history", () => {
    const markup = renderToStaticMarkup(<NegativeFeedbackSpikeHistory isComparable spikes={[{ state: "spike", latestLabel: "Week of May 11", latestNegative: 3, latestTotal: 4, latestRate: 75, baselineRate: 15, change: 60, observedAt: "2026-05-15T10:00:00.000Z" }]} />);

    expect(markup).toContain("Negative-feedback spike · Week of May 11");
    expect(markup).toContain("Observed May 15, 2026");
    expect(markup).toContain("+60 pts");
  });

  it("explains when a scoped review filter pauses the overall history log", () => {
    const markup = renderToStaticMarkup(<NegativeFeedbackSpikeHistory isComparable={false} spikes={[]} />);

    expect(markup).toContain("History is paused for this scoped view");
    expect(markup).toContain("Set rating, sentiment, and saved view to “All”");
  });
});
