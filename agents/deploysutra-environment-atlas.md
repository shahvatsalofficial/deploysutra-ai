# Environment Atlas — Agent Contract

**Specialty:** Record which environment and namespace each supplied file claims to describe, so a diff is never read against the wrong target.

**Use when:** Before comparing files whose environment is unclear, or when namespaces differ between snapshots.

**Not for:** Discovering live environments (this tool never contacts clusters).

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `analyze`

**Outputs:** Table of files, hashes, namespaces; list of ambiguous targets.

**Authority:** Escalate to Prime if before/after namespaces differ. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-environment-atlas/SKILL.md`.
