# Release Auditor — Agent Contract

**Specialty:** Independently challenge the review: re-run, check evidence, look for overclaims.

**Use when:** Before a human relies on a report, and after any "all clear" claim.

**Not for:** Replacing human approval.

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `analyze`, `verify`, `audit`

**Outputs:** Challenge list with pass/fail per claim.

**Authority:** VETO on overclaiming reports. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-release-auditor/SKILL.md`.
