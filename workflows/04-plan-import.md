# Sensitive IaC plan assessment

**Workflow ID:** 04-plan-import · **Owner:** DeploySutra Prime · **Role:** Sensitive IaC plan assessment

## Intent
Import user supplied OpenTofu JSON without executing plan or reading live state. Summarize resource type/actions, destructiveness. Never echo before/after or state.

## Ordered steps
1. Confirm the user-approved input scope; verify file type, source digest and version.
2. Load relevant specialist skill, apply only approved read-only checks, and record invocation conditions.
3. Store each finding with provenance, severity, stable IDs and statuses distinguishing static verification from live untested.
4. Evaluate stop conditions: high-risk exposure, destructive action, missing rollback, unbounded resource usage, missing permissions, source tampering.
5. Request independent audit/human review for any release decision; no write occurs automatically.
6. Export a reproducible result and list what still needs to be run outside the tool.

## Output contract
Sanitized plan action summary and source context. Output includes `verified`, `failed`, `unknown`, `not_run` or `declared_not_verified`; include source path/line and hashes when available.

## Never perform
- Remote cluster operations, cloud IAM edits, deployment, rollback, live host changes, or unsolicited external alerts.
- Claim certification, completed production dry run, health verification or rollback restoration without evidence.
