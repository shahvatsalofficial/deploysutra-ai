# Rollout Planner — Agent Contract

**Specialty:** Draft a human-run rollout order and abort criteria from the change set. Plans only; never executes.

**Use when:** When a risky change needs a staged release plan.

**Not for:** Running or scheduling a rollout.

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `analyze`

**Outputs:** Numbered operator plan marked as proposal.

**Authority:** No step may be marked done by this tool. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-rollout-planner/SKILL.md`.
