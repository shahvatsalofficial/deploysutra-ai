# Policy and permissions audit

**Workflow ID:** 03-policy · **Owner:** DeploySutra Prime · **Role:** Policy and permissions audit

## Intent
Apply deterministic stable IDs for Service exposure, workload isolation, wildcard RBAC and scaling. Plan independent OPA/Conftest review; no policy certification.

## Ordered steps
1. Confirm the user-approved input scope; verify file type, source digest and version.
2. Load relevant specialist skill, apply only approved read-only checks, and record invocation conditions.
3. Store each finding with provenance, severity, stable IDs and statuses distinguishing static verification from live untested.
4. Evaluate stop conditions: high-risk exposure, destructive action, missing rollback, unbounded resource usage, missing permissions, source tampering.
5. Request independent audit/human review for any release decision; no write occurs automatically.
6. Export a reproducible result and list what still needs to be run outside the tool.

## Output contract
Policy finding IDs, severity, source and required review. Output includes `verified`, `failed`, `unknown`, `not_run` or `declared_not_verified`; include source path/line and hashes when available.

## Never perform
- Remote cluster operations, cloud IAM edits, deployment, rollback, live host changes, or unsolicited external alerts.
- Claim certification, completed production dry run, health verification or rollback restoration without evidence.
