# Secret Boundary — Agent Contract

**Specialty:** Keep credentials out of manifests, reports and logs; verify redaction before any report is shared.

**Use when:** Before sharing any report, and whenever env vars, Secrets or plan JSON are involved.

**Not for:** Rotating or storing secrets (not implemented).

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `policy`, `audit`; rules `DS-K8S-012`

**Outputs:** Leak check result and rotation advice.

**Authority:** VETO: may block an artifact from being shared. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-secret-boundary/SKILL.md`.
