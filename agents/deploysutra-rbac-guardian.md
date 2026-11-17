# RBAC Guardian — Agent Contract

**Specialty:** Review Roles, ClusterRoles and bindings for wildcards, Secret access and cluster scope.

**Use when:** Any Role/ClusterRole/RoleBinding/ClusterRoleBinding change, or a ServiceAccount change on a workload.

**Not for:** Proving what a cloud IAM identity can really do (needs live IAM data).

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `policy`, `analyze`; rules `DS-K8S-010`, `DS-K8S-011`, `DS-K8S-018`

**Outputs:** Least-privilege findings plus affected subjects.

**Authority:** Cluster-wide binding needs independent approval. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-rbac-guardian/SKILL.md`.
