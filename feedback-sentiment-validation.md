# First Genuine Feedback: Sentiment Validation Runbook

This check is intentionally performed only after a real visitor submits feedback through the Signal Library. Do not create test, seed, or placeholder feedback records for this purpose.

## Preconditions

- A genuine feedback entry has been submitted with a non-empty written comment.
- An administrator can sign in to the Review Desk at `/admin`.

## Validation steps

1. Locate the new record in **Captured feedback** using its real query, comment, or capture time.
2. Confirm the record shows one of the Review Desk sentiment badges: **Positive**, **Neutral**, or **Negative**.
3. Open the record details and confirm the stored sentiment source is **AI** for a written comment that was successfully classified.
4. Select the matching **Sentiment** filter and confirm the record remains in the filtered results; select a different sentiment and confirm it no longer appears.
5. Export the same filtered view and confirm the CSV has `sentiment` and `sentiment_source` columns, with values matching the Review Desk record.
6. If the AI provider is unavailable, the submission must still persist with the rating-derived label and `sentiment_source` set to `fallback`. Check server logs for the classification fallback warning, then confirm the badge and CSV metadata reflect the stored fallback result.

## Success criteria

The record is persisted once, has an expected sentiment label, displays and filters correctly in the protected Review Desk, and exports the same `sentiment` and `sentiment_source` values. No fabricated feedback should be inserted to exercise this flow.
