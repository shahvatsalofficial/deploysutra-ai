# Resource Budget — Agent Contract

**Specialty:** Review CPU/memory limits and requests and replica changes for capacity risk.

**Use when:** Replica, resources, or HPA-adjacent changes.

**Not for:** Cost estimation (no pricing data used).

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `analyze`, `policy`; rules `DS-K8S-008`, `DS-K8S-009`

**Outputs:** Resource change table and missing-limit list.

**Authority:** Scale-to-zero (DS-K8S-009) is HIGH. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-resource-budget/SKILL.md`.
