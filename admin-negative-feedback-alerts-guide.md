# Negative Feedback Spike Alerts: Admin Guide

Use this guide in the **Review Desk** to configure, read, and act on negative-feedback spike signals. The dashboard uses only collected shared feedback; it does not create sample records or fill in missing history.

## 1. Open the Review Desk

1. Sign in with an **admin** account.
2. Select **Review Desk** in the sidebar, or go to `/admin`.
3. At the top of the dashboard, find **Spike monitor preferences**, followed by the current **Negative-spike monitor** status.

## 2. Set the comparison window

The **Comparison window** controls how many earlier periods form the baseline for the newest period.

| Option | Use it when | Effect |
|---|---|---|
| **2 prior periods** | You want the monitor to react sooner. | More responsive to a recent change. |
| **3 prior periods** | You want a balanced comparison. | Smooths one unusual earlier period. |
| **4 prior periods** | You want fewer, more conservative alerts. | Requires a longer history before comparing. |

The default is **2 prior periods**. Choose a longer window if feedback volume is variable and you want to reduce sensitivity.

## 3. Set alert-history retention

The **History retention** setting determines how many recent feedback periods are considered for entries in the **Negative-spike alert log**.

| Option | Recommended use |
|---|---|
| **3 recent periods** | A compact, short-term review. |
| **6 recent periods** | The default operational view. |
| **12 recent periods** | A longer review for recurring issues. |

Settings are stored **only in the current browser**. They change dashboard analysis and the reconstructed alert log; they do not modify feedback records. Select **Reset defaults** at any time to restore the 2-period comparison and 6-period retention settings.

## 4. Understand the monitor status

> **Calibrating** means the dashboard does not yet have enough populated feedback periods for the selected comparison window. It is not an error and it is not an alert.

| Status | Meaning | What to do |
|---|---|---|
| **Calibrating** | There is insufficient period history. | Wait for genuine feedback across additional periods. |
| **No material spike** | The latest negative-feedback rate does not meet the alert thresholds. | Continue normal review. |
| **Negative-feedback spike detected** | The latest period crosses the minimum volume, negative-rate, and baseline-increase thresholds. | Open the captured-feedback list and review the newest negative comments and queries. |
| **Scoped by a review filter** | A rating, sentiment, or saved-view filter prevents an overall comparison. | Set those controls to **All** to evaluate the full feedback stream. |

For a whole-support-stream check, also clear the status, issue-category, keyword, and date filters. This keeps the monitor aligned with the broadest available feedback view.

## 5. Read the alert history

Each entry in **Negative-spike alert log** contains:

- The flagged feedback period.
- The observed timestamp, based on the latest captured feedback record in that period.
- The percentage-point increase from the configured trailing baseline.
- The negative-signal count and negative-feedback rate for the period.

The history is **reconstructed from the selected shared feedback history**. It is not a separate notification inbox. An empty log truthfully means no period in the retained analysis window met the configured spike criteria.

## 6. Recommended response to an alert

1. Keep the settings and filters visible so your findings can be reproduced.
2. In **Captured feedback**, filter to **Needs work** or **Negative** sentiment.
3. Open the newest entries and look for a repeated query, product area, source page, or issue category.
4. Set a review status and add a concise reviewer note for the team.
5. Use the existing CSV export when you need to share the filtered evidence outside the Review Desk.

## 7. Quick troubleshooting

| Question | Answer |
|---|---|
| Why does the monitor not alert yet? | It needs enough populated periods for the selected comparison window and must meet the conservative spike thresholds. |
| Why did the alert log change? | Changing the comparison or retention setting, date range, or feedback scope recalculates the history from shared records. |
| Why are my settings different on another device? | Preferences are local to each browser. |
| Does changing settings edit past feedback? | No. It only changes how the dashboard analyzes and presents existing feedback. |
