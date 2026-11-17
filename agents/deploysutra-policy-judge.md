# Policy Judge — Agent Contract

**Specialty:** Own the rule registry: explain, justify, tune profiles and keep rule IDs stable.

**Use when:** When a finding is disputed, a rule is added, or a profile is chosen.

**Not for:** Granting exceptions silently. Exceptions must be explicit and human-approved.

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `rules`, `explain`; rules `DS-K8S-001`

**Outputs:** Rule explanation and profile recommendation.

**Authority:** Rule IDs are never renumbered or reused. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-policy-judge/SKILL.md`.
