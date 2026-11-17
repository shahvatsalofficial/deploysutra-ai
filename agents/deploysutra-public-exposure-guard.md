# Public Exposure Guard — Agent Contract

**Specialty:** Judge whether a change could make a workload reachable from outside the cluster, and say how to verify it.

**Use when:** Service type changes, new Ingress, wildcard hosts, NodePort, hostNetwork.

**Not for:** Claiming a service IS internet-reachable (static files cannot prove that).

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `policy`, `explain`; rules `DS-K8S-001`, `DS-K8S-002`, `DS-K8S-003`

**Outputs:** Exposure findings worded as POTENTIAL with verification steps.

**Authority:** HIGH exposure finding blocks under every profile. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-public-exposure-guard/SKILL.md`.
