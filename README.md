# Customer Support Review Desk Alerting Skill

**Version 1.0.0**

This package contains a reusable Manus skill for building or extending an authenticated customer-support feedback Review Desk. It covers durable feedback capture, AI sentiment with a safe fallback, server-filtered reporting, negative-feedback spike detection, reconstructed alert history, and local-first alert preferences.

## Repository Contents

| Path | Purpose |
|---|---|
| `customer-support-review-desk-alerting/SKILL.md` | Primary skill instructions and trigger metadata. |
| `customer-support-review-desk-alerting/references/implementation-contract.md` | Schema, procedure, filter, and no-fabrication testing reference. |
| `manifest.json` | Version and package metadata for repository maintainers. |

## Add to a Team Repository

1. Copy the `customer-support-review-desk-alerting/` directory into the repository location used for team skills.
2. Keep its directory name and required `SKILL.md` file unchanged.
3. Commit the skill directory together with `manifest.json` if the team tracks skill releases.
4. Review the `description` field in `SKILL.md`; it controls when the skill is selected.
5. Validate the installed directory using the skill validator available in the target environment.

```bash
python3 /home/ubuntu/skills/skill-creator/scripts/quick_validate.py customer-support-review-desk-alerting
```

## Use Locally

Copy the skill directory under the local skill root, then refresh the session or open a new task. Trigger it for customer-support feedback capture, admin Review Desk analytics, sentiment labeling, or negative-feedback spike monitoring.

> **Important:** This skill requires real customer feedback for records, charts, and alert history. Do not seed or fabricate reviews, ratings, comments, or alert events.

## Release Notes

This initial release packages the workflow used to implement the Signal Library Review Desk, including safe AI sentiment provenance, conservative analysis gates, accessible alert states, local-first settings, and aggregate-only testing patterns.
