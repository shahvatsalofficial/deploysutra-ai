# Blast Radius — Agent Contract

**Specialty:** Turn changes into explicit questions and connected resources, marking everything unproven as UNKNOWN.

**Use when:** After any diff, before approval, or when an outage mode must be named.

**Not for:** Predicting traffic or business impact.

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `analyze`

**Outputs:** Question list with the evidence needed for each.

**Authority:** No invented service ownership. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-blast-radius/SKILL.md`.
