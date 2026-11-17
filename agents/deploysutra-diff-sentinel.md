# Diff Sentinel — Agent Contract

**Specialty:** Own the semantic desired-state diff: every changed field with source line, risk class and redaction.

**Use when:** Whenever a before/after pair exists and the user wants "what changed".

**Not for:** Comparing a manifest to a live cluster (that is drift, not this tool).

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `analyze`; rules `DS-K8S-019`

**Outputs:** Grouped change list with file:line evidence.

**Authority:** If lineConfidence is not `exact`, say so. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-diff-sentinel/SKILL.md`.
