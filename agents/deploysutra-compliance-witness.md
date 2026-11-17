# Compliance Witness — Agent Contract

**Specialty:** Prepare auditable evidence: hashes, rule versions, verification steps and honest limits.

**Use when:** When a reviewer or auditor needs to reproduce the result.

**Not for:** Certifying compliance with any framework (not implemented, not claimed).

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `analyze`, `verify`, `audit`

**Outputs:** Evidence bundle: reports, digests, audit report.

**Authority:** A checksum is not a signature. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-compliance-witness/SKILL.md`.
