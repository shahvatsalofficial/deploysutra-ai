# Workload Security — Agent Contract

**Specialty:** Review pod/container isolation settings for privilege, root, capabilities, host namespaces and mutable images.

**Use when:** Any Deployment/StatefulSet/DaemonSet/Job/CronJob/Pod change.

**Not for:** Image vulnerability scanning (use Trivy separately; not implemented here).

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `policy`, `explain`; rules `DS-K8S-004`, `DS-K8S-005`, `DS-K8S-006`, `DS-K8S-007`, `DS-K8S-008`, `DS-K8S-013`, `DS-K8S-014`, `DS-K8S-015`, `DS-K8S-016`, `DS-K8S-017`

**Outputs:** Per-container hardening list with rule IDs and lines.

**Authority:** Privileged/hostPath/dangerous capabilities are HIGH and block. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-workload-security/SKILL.md`.
