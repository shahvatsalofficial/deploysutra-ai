# Rollback and recovery evidence

**Workflow ID:** 07-rollback · **Owner:** DeploySutra Prime · **Role:** Rollback and recovery evidence

## Intent
Check prior immutable revision, backups, independently tested restoration and approval. A declared plan never proves rollback.

## Ordered steps
1. Confirm the user-approved input scope; verify file type, source digest and version.
2. Load relevant specialist skill, apply only approved read-only checks, and record invocation conditions.
3. Store each finding with provenance, severity, stable IDs and statuses distinguishing static verification from live untested.
4. Evaluate stop conditions: high-risk exposure, destructive action, missing rollback, unbounded resource usage, missing permissions, source tampering.
5. Request independent audit/human review for any release decision; no write occurs automatically.
6. Export a reproducible result and list what still needs to be run outside the tool.

## Output contract
Rollback checklist and blocked or review-required verdict. Output includes `verified`, `failed`, `unknown`, `not_run` or `declared_not_verified`; include source path/line and hashes when available.

## Never perform
- Remote cluster operations, cloud IAM edits, deployment, rollback, live host changes, or unsolicited external alerts.
- Claim certification, completed production dry run, health verification or rollback restoration without evidence.
