# DeploySutra AI

> **Trace the Change. Prove the Risk. Deploy by Human Decision.**

[![CI](https://github.com/shahvatsalofficial/deploysutra-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/shahvatsalofficial/deploysutra-ai/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/deploysutra-ai.svg)](https://www.npmjs.com/package/deploysutra-ai)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![Node >=20](https://img.shields.io/badge/node-%E2%89%A520-brightgreen)
![Dependencies: 0](https://img.shields.io/badge/runtime%20dependencies-0-success)

**Offline, read-only deployment risk and reversibility analysis for Kubernetes manifests and OpenTofu/Terraform plans.** Compare two versions of your manifests, see every change with its source line, get a sourced list of risks (public exposure, privileged containers, secrets in env vars, scale-to-zero, wildcard RBAC...), see what else is connected, check rollback evidence, and get a report as **HTML, Markdown and JSON**. It never deploys, never touches a cluster, never needs an API key, and **its gate can only say `BLOCKED` or `HUMAN_REVIEW_REQUIRED`. There is no "READY".**

**Docs site: https://shahvatsalofficial.github.io/deploysutra-ai/**

Created and maintained by **Vatsal Shah** · Apache-2.0 · Node.js 20+ · zero runtime dependencies

```bash
npx deploysutra-ai analyze --before old.yaml --after new.yaml --profile production --out report
# open report/deploy-readiness.html     (exit code 2 = BLOCKED, handy for CI)
```

## Why you can trust (or check) it
| Claim | How it is verified | Recorded result (v0.2.0) |
|---|---|---|
| Never deploys; no apply/deploy/destroy/rollback command | CLI tests + audit scan of `help` | pass |
| No network, no subprocess in analysis code, no `eval` | audit scans `packages/` | pass |
| Secrets never reach reports | canary strings planted in env, Secret data, annotations, plan variables, prior state, addresses | 0 found |
| Unsupported YAML fails loudly, never skipped | 18 parser tests + 15 hostile inputs + 400 seeded mutations | all handled |
| Gate cannot say "ready" | corpus of 50 resources assessed with every rollback box ticked | none ready |
| Same input, same digest | determinism + tamper tests | pass |
| Rules do what they say | 50-case labelled corpus | exact *(author-labelled, not independent)* |

**312 tests: 308 passed, 0 failed, 4 skipped** (symlink tests on a machine whose OS user cannot create symlinks; CI runs them) · **independent self-audit: 42 passed, 0 failed, 7 explicitly not run** · recorded on Windows 11, Node 24.

Run the audit yourself and get **MD + HTML + JSON** evidence on your own machine:
```bash
npx deploysutra-ai audit --out audit-out
```
See [docs/AUDIT_REPORTS.md](docs/AUDIT_REPORTS.md), the recorded run in [docs/proof/](docs/proof/), and the full documentation set (executive, functional, architecture, technical, user guide, security, test report, legal, FAQ) built as HTML + Markdown in the maintainer's `documents` folder.

> Honest limits: the corpus is written by the author, nobody independent has reviewed the code, desired-state diffs are not live drift, and static rules are heuristics. Every report lists what was `NOT_RUN` or `NOT_TESTED`.

## What you get
```text
# DeploySutra AI - Kubernetes desired-state review

**Gate:** BLOCKED (NEVER an authorization to deploy)

## Why
- New HIGH finding DS-K8S-003 on Deployment/demo/checkout
- New HIGH finding DS-K8S-004 on Deployment/demo/checkout
- Rollback evidence missing: prior_revision, backup_verified, restore_test, ...

| Rule       | Severity | Status | Resource                 | Message                        | Where                      |
| DS-K8S-004 | HIGH     | new    | Deployment/demo/checkout | Container is privileged        | fixtures/k8s/after.yaml:18 |
| DS-K8S-009 | HIGH     | new    | Deployment/demo/checkout | Replicas set to zero ...       | fixtures/k8s/after.yaml:7  |
```
Sample reports: [BLOCKED review](examples/reports/demo/deploy-readiness.html) · [multi-document stack](examples/reports/stack/deploy-readiness.html) · [clean review (still needs a human)](examples/reports/hardened-clean/deploy-readiness.html) · [plan summary](examples/reports/tofu/deploy-readiness.html) · [audit report](docs/proof/audit-report.html).

## Features
- **DiffProof**: semantic diff of whole objects, containers matched by name, **exact line numbers** from the parser, sensitive values redacted.
- **19 stable rules** `DS-K8S-001..019` with trigger, rationale, remediation and false-positive notes (`deploysutra explain DS-K8S-012`).
- **Profiles** `development`, `staging`, `production` decide what blocks. New *and* persistent risk is reported.
- **BlastMap**: Service→workload, Ingress→Service, workload→ConfigMap/Secret/PVC/ServiceAccount, binding→role edges from the manifests you gave it. Anything else is `UNKNOWN`.
- **Rollback Ledger**: five prerequisites; declarations are `DECLARED_NOT_VERIFIED`, never "ready".
- **Multi-document YAML and JSON** (including `List`), added/removed resources detected.
- **OpenTofu/Terraform plan summary**: action counts per resource type, replacement and data-bearing destructive detection, truncation flagged; **no state, values or addresses kept**.
- **Reports** as HTML (accessible, light/dark, print, no JavaScript), Markdown and JSON, sealed with SHA-256.
- **Independent self-audit**, **read-only MCP server**, **loopback report API**, **25 Agent Skills + 20 role files** for Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI and OpenCode.

## Quick start
```bash
node --version                 # 20+
npx deploysutra-ai doctor
git clone https://github.com/shahvatsalofficial/deploysutra-ai && cd deploysutra-ai
npm test && npm run demo
```
### CLI
```bash
deploysutra analyze --before a.yaml --after b.yaml [--rollback evidence.json] [--profile production] [--out dir] [--format md|json|html]
deploysutra policy  --input app.yaml --fail-on HIGH
deploysutra rules
deploysutra explain DS-K8S-012
deploysutra tofu    --input plan.json --out dir
deploysutra verify  --report dir/deploy-readiness.json
deploysutra audit   --out audit-out
deploysutra install-skills --host claude --target .
deploysutra mcp --root .
```
Exit codes: `0` ok · `1` error · `2` BLOCKED (or `--fail-on` hit) · `3` report failed verification.

### GitHub Actions
```yaml
- run: npx -y deploysutra-ai analyze --before base/app.yaml --after app.yaml --profile production --out report
- if: always()
  uses: actions/upload-artifact@v4
  with: {name: deploysutra-report, path: report}
```

### Use from an AI assistant (MCP)
```json
{"mcpServers": {"deploysutra": {"command": "npx", "args": ["-y", "deploysutra-ai", "mcp", "--root", "."]}}}
```
Tools: `compare_manifests`, `explain_policy`, `list_policies`, `summarize_plan_actions`, `list_rollback_gaps`, `verify_evidence`. Read-only, one workspace, relative paths only. Verified with a scripted JSON-RPC client; not with MCP Inspector.

## Supported input (exact)
Kubernetes YAML/JSON up to 1 MiB and 200 documents: block mappings/sequences, plain and quoted scalars, `[]`, `{}`, one-line scalar lists, comments, `---`. **Rejected with a clear error:** anchors, aliases, tags, merge keys, block scalars (`|`, `>`), nested flow collections, Helm/Go templates, tabs, odd indentation, duplicate keys, symlinks. Render Helm/Kustomize to plain YAML with a separately authorised tool first.

## What it is not
Not a deployment tool or controller, not an admission policy engine (use OPA/Kyverno for that), not an image scanner, not a compliance certificate, and not proof of live state, network reachability, IAM scope or recoverability. The desired-state diff is **not** drift.

## Documentation
[Status matrix](docs/STATUS.md) · [Architecture](docs/ARCHITECTURE.md) · [Evidence model](docs/EVIDENCE_MODEL.md) · [Threat model](docs/THREAT_MODEL.md) · [Audit reports](docs/AUDIT_REPORTS.md) · [Skills and agents](docs/SKILLS_AND_AGENTS.md) · [Legal and trust](docs/LEGAL_AND_TRUST.md) · [IDE compatibility](docs/IDE_COMPATIBILITY.md) · [Workflows](docs/WORKFLOWS.md) · [Roadmap](ROADMAP.md) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## FAQ (short)
**Does it deploy?** No, and the audit checks that no such command exists. **Needs credentials or a cluster?** No. **Sends data anywhere / needs an AI key?** No. **Replaces OPA/Gatekeeper/Kyverno?** No; it reviews before release, they enforce at admission. **Why no green "READY"?** Static checks cannot prove safety, so the only honest outcomes are "blocked" and "a human decides".

## Related search terms
Kubernetes deployment risk analysis, manifest diff, pre-deployment checklist, release gate, rollback readiness, blast radius, policy as code, DevSecOps, SRE, platform engineering, OpenTofu plan review, Terraform plan summary, Claude Code skills, MCP server for Kubernetes review.

## Cite, license, attribution
Apache-2.0, copyright 2026 Vatsal Shah. See [LICENSE](LICENSE), [NOTICE](NOTICE), [CITATION.cff](CITATION.cff). Third-party product names are trademarks of their owners and used for identification only; the name "DeploySutra" has not been trademark-searched.
