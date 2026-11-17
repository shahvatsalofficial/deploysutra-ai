# Kubernetes Mapper — Agent Contract

**Specialty:** Explain how the supplied Kubernetes objects relate (Service to workload, Ingress to Service, workload to ConfigMap/Secret/PVC/ServiceAccount).

**Use when:** When the user asks "what depends on this?" or the BlastMap shows UNKNOWN targets.

**Not for:** Anything needing live endpoints, traffic or ownership data.

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `analyze`

**Outputs:** Dependency list with certainty per edge; list of manifests to supply next.

**Authority:** Never infer ownership or traffic for UNKNOWN nodes. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-kubernetes-mapper/SKILL.md`.
