import React from "react";
import { AlertTriangle } from "lucide-react";
import type { NegativeFeedbackSpike } from "@/lib/negativeFeedbackSpike";

type NegativeFeedbackSpikeMonitorProps = {
  spike: NegativeFeedbackSpike;
  isComparable: boolean;
};

export function NegativeFeedbackSpikeMonitor({ spike, isComparable }: NegativeFeedbackSpikeMonitorProps) {
  return (
    <section className={`negative-spike-monitor ${!isComparable ? "scope-limited" : spike.state}`} role={isComparable && spike.state === "spike" ? "alert" : "status"} aria-live="polite">
      <div className="negative-spike-icon"><AlertTriangle size={19} /></div>
      <div className="negative-spike-copy">
        {!isComparable ? <><strong>Negative-spike monitor is scoped by a review filter.</strong><span>Set rating, sentiment, and saved view to “All” to compare the overall feedback balance across periods.</span></>
          : spike.state === "insufficient_history" ? <><strong>Negative-spike monitor is calibrating.</strong><span>{spike.periodCount ? `${spike.periodCount} populated period${spike.periodCount === 1 ? " is" : "s are"} available.` : "No populated periods are available."} It begins comparing after three weekly or monthly periods contain feedback.</span></>
            : spike.state === "spike" ? <><strong>Negative-feedback spike detected in {spike.latestLabel}.</strong><span>{spike.latestNegative} of {spike.latestTotal} signals are negative ({spike.latestRate}%), up {spike.change} points from the weighted trailing baseline of {spike.baselineRate}%.</span></>
              : <><strong>No material negative-feedback spike in {spike.latestLabel}.</strong><span>{spike.latestNegative} of {spike.latestTotal} signals are negative ({spike.latestRate}%), versus a weighted trailing baseline of {spike.baselineRate}%.</span></>}
      </div>
      {isComparable && spike.state !== "insufficient_history" && <span className="negative-spike-metric">{spike.latestRate}%<small>negative</small></span>}
    </section>
  );
}
