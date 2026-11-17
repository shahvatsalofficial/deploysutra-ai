# DeploySutra AI - Verified Implementation Status (v0.2.0)

Not a production deployment controller. It analyses files and writes reports; humans decide. Maturity words: **Implemented**, **Tested** (automated tests exist and pass), **Planned**, **Unsupported**.

| Capability | Implemented | Tested | Notes |
|---|---|---|---|
| Strict YAML subset, multi-document, exact line map | Yes | Yes | Rejects anchors, aliases, tags, templates, block scalars, nested flow, tabs, `...`, duplicate/unsafe keys |
| JSON manifests (object, array, `List`) with exact line map | Yes | Yes | |
| Bounded, symlink-refusing file reader | Yes | Yes | Symlink tests skip (and say so) where the OS user cannot create symlinks |
| Semantic desired-state diff with redaction | Yes | Yes | All containers matched by name; Secret data/password-named keys/secret env redacted |
| 19 static rules DS-K8S-001..019 | Yes | Yes | 50-case author-labelled corpus: precision 100%, recall 100% on that corpus |
| Profiles development/staging/production | Yes | Yes | Explicit selection recorded |
| New vs persistent finding classification | Yes | Yes | Persistent HIGH risk blocks |
| BlastMap (edges from supplied manifests only) | Yes | Yes | Unsupplied targets are `UNKNOWN` |
| Rollback evidence model | Yes | Yes | Declarations are never verification |
| OpenTofu/Terraform plan **action** summary | Yes | Yes | Replacement detection, truncation flag, discarded-section names; no state, addresses or values kept |
| Reports in JSON + Markdown + HTML (accessible, self-contained) | Yes | Yes | |
| Independent self-audit (JSON + MD + HTML) | Yes | Yes | `deploysutra audit` |
| Seal + `verify` | Yes | Yes | Unkeyed SHA-256: tamper evidence, not a signature |
| CLI exit codes (0 / 1 / 2 BLOCKED / 3 bad seal) | Yes | Yes | |
| Loopback read-only report API | Yes | Yes | Local demo only; no TLS/RBAC/tenancy |
| MCP server (stdio, six read-only tools) | Yes | Scripted JSON-RPC client | MCP Inspector and third-party clients **not** run |
| 25 skills + 20 agent files, project-local installer for 6 IDE layouts | Yes | File copy tested | Native activation in each IDE **untested** |
| GitHub Actions CI (3 OS x 3 Node), package smoke test, secret scan | Yes | See Actions tab | |
| npm package `deploysutra-ai` | Yes | `npm pack` + clean-install smoke in CI | |
| Official YAML AST parser, JSON-schema admission validation | Planned | | Needs a dependency ADR |
| OPA/Conftest, Helm/Kustomize rendering, Trivy, Cosign | Planned | | Opt-in, sandboxed, version-pinned adapters |
| Live `kubectl diff`/dry run, observed drift, live RBAC | Unsupported | | Needs credentials; never automatic |
| Canary/SLO evidence, real rollback drills | Unsupported | | Always `NOT_RUN` here |
| Signed provenance, dashboard, multi-tenant server | Planned | | |
| Deploy/apply/destroy/rollback execution | Unsupported by design | | No such command exists |

## Checks reported on every Kubernetes review
`manifestParsing` and `policyRules`: `VERIFIED_STATIC`. `environmentDrift`, `liveRBAC`: `NOT_TESTED`. `clusterDryRun`, `workloadHealth`, `realRollback`: `NOT_RUN`. `humanApproval`: `NOT_VERIFIED`.

## Honest gaps
- Rules are heuristics over desired state; admission mutation, defaulting, controllers, NetworkPolicy and cloud firewalls are not modelled.
- The corpus is author-labelled; no independent benchmark exists yet.
- YAML coverage is a documented subset by design. Render Helm/Kustomize first with a separately authorised tool.
- Data-bearing detection in plans is a resource-type name heuristic.
- Only the platform in `docs/proof/environment.json` was measured in the recorded run; other platforms are covered by CI.
