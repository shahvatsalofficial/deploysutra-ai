# DeploySutra Roadmap

Maturity key: **Done** (code + tests), **Partial**, **Planned** (no code), **Not planned**.

| Phase | Milestone | Status | Evidence |
|---|---|---|---|
| 0 | Threat model, truth matrix | Done | `docs/THREAT_MODEL.md`, `docs/STATUS.md` |
| 1 | Offline manifest analyzer: multi-document YAML/JSON, source maps, 19 rules, profiles | Done | `tests/core.test.mjs`, rule corpus 50/50 |
| 2 | Secret-safe imported OpenTofu/Terraform plan summary | Done | canary leak checks in `deploysutra audit` |
| 3 | Reports in Markdown + HTML + JSON, self-audit | Done | `docs/AUDIT_REPORTS.md`, `docs/proof/` |
| 4 | Read-only MCP server (stdio) | Done (scripted client only) | `tests/mcp.test.mjs`; MCP Inspector not run |
| 5 | Portable skills and project-local installer | Done as file copy | Native activation per IDE untested |
| 6 | Official YAML AST parser + JSON-schema admission validation | Planned | Needs a vetted dependency decision (ADR) |
| 7 | OPA/Conftest policy pack with traced decisions | Planned | Rego mapping of DS-K8S rules |
| 8 | Isolated Helm/Kustomize rendering (no network, bounded) | Planned | Separately authorised renderer |
| 9 | Read-only live drift and RBAC adapter | Planned | Needs a reviewed list of required verbs |
| 10 | Canary/health/rollback evidence from external systems, operator sign-off record | Planned | Separate release controller |
| 11 | Signed provenance for reports | Planned | Explicit trust root and key rotation |
| 12 | Accessible web dashboard and self-hosted RBAC server | Not started | Only after parser truth and approval semantics are strong |

**Definition of done:** real code, executed tests, negative security cases, evidence, documentation, and no fabricated compatibility or deployment outcomes. Nothing here promises a date.
