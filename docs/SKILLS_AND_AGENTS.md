# Skills and agents: what each is for, what backs it, when NOT to use it

Every skill is generated from one table (`scripts/generate-skills.mjs`) and checked by `tests/skills.test.mjs`: each skill must name real CLI commands and real rule IDs. A skill that no command or rule backs is judgement-only and says so.

**Do you need all 25?** No. For a normal review use **DeploySutra Prime** (or just run `deploysutra analyze`). The specialists exist so a host with subagents can parallelise, and so a human can ask one narrow question. If your IDE has no subagents, follow the single-assistant fallback: run the commands in the order below.

Order for a single assistant: `doctor` → `analyze` → `policy` (+ `explain`) → `tofu` (if a plan exists) → `verify` → `audit`.

| Skill | Kind | Use when | Backed by |
|---|---|---|---|
| `deploysutra-prime` | specialist | Any request to "review this deployment/change". It is the entry point; it delegates and never approves. | `analyze`, `tofu`; `DS-K8S-019` |
| `deploysutra-environment-atlas` | specialist | Before comparing files whose environment is unclear, or when namespaces differ between snapshots. | `analyze` |
| `deploysutra-kubernetes-mapper` | specialist | When the user asks "what depends on this?" or the BlastMap shows UNKNOWN targets. | `analyze` |
| `deploysutra-diff-sentinel` | specialist | Whenever a before/after pair exists and the user wants "what changed". | `analyze`; `DS-K8S-019` |
| `deploysutra-public-exposure-guard` | specialist | Service type changes, new Ingress, wildcard hosts, NodePort, hostNetwork. | `policy`, `explain`; `DS-K8S-001`, `DS-K8S-002`, `DS-K8S-003` |
| `deploysutra-workload-security` | specialist | Any Deployment/StatefulSet/DaemonSet/Job/CronJob/Pod change. | `policy`, `explain`; `DS-K8S-004`, `DS-K8S-005`, `DS-K8S-006`, `DS-K8S-007`, `DS-K8S-008`, `DS-K8S-013`, `DS-K8S-014`, `DS-K8S-015`, `DS-K8S-016`, `DS-K8S-017` |
| `deploysutra-rbac-guardian` | specialist | Any Role/ClusterRole/RoleBinding/ClusterRoleBinding change, or a ServiceAccount change on a workload. | `policy`, `analyze`; `DS-K8S-010`, `DS-K8S-011`, `DS-K8S-018` |
| `deploysutra-secret-boundary` | specialist | Before sharing any report, and whenever env vars, Secrets or plan JSON are involved. | `policy`, `audit`; `DS-K8S-012` |
| `deploysutra-iac-interpreter` | specialist | The user supplies `tofu show -json` output. | `tofu` |
| `deploysutra-drift-witness` | specialist | When anyone says "drift" or "what is actually running". | `analyze` |
| `deploysutra-blast-radius` | specialist | After any diff, before approval, or when an outage mode must be named. | `analyze` |
| `deploysutra-policy-judge` | specialist | When a finding is disputed, a rule is added, or a profile is chosen. | `rules`, `explain`; `DS-K8S-001` |
| `deploysutra-resource-budget` | specialist | Replica, resources, or HPA-adjacent changes. | `analyze`, `policy`; `DS-K8S-008`, `DS-K8S-009` |
| `deploysutra-rollout-planner` | specialist | When a risky change needs a staged release plan. | `analyze` |
| `deploysutra-canary-evidence` | specialist | When a release needs progressive delivery evidence. | `analyze` |
| `deploysutra-rollback-architect` | specialist | Any release gate; mandatory for stateful or destructive changes. | `analyze` |
| `deploysutra-health-gate` | specialist | Whenever someone asks "is it safe to ship?". | `analyze`, `verify` |
| `deploysutra-compliance-witness` | specialist | When a reviewer or auditor needs to reproduce the result. | `analyze`, `verify`, `audit` |
| `deploysutra-ide-bridge` | specialist | When a user asks to use DeploySutra from Claude Code, Cursor, Codex, Gemini CLI, Copilot or OpenCode. | `install-skills`, `doctor` |
| `deploysutra-release-auditor` | specialist | Before a human relies on a report, and after any "all clear" claim. | `analyze`, `verify`, `audit` |
| `deploysutra-deploy-diff` | capability | The user has two manifest files and wants a safe change summary. | `analyze` |
| `deploysutra-iac-sanity` | capability | The user supplies plan JSON. | `tofu` |
| `deploysutra-preview-environment` | capability | A team wants a checklist for a preview/staging review. | `analyze` |
| `deploysutra-rollout-guard` | capability | A release candidate needs a final static check. | `analyze` |
| `deploysutra-rollback-plan` | capability | Before any change that cannot be undone by re-applying the old manifest. | `analyze` |

Authority: no skill can approve a deployment. Secret Boundary and Release Auditor may veto sharing or overclaiming. The gate has two states only: `BLOCKED` and `HUMAN_REVIEW_REQUIRED`.
