# Changelog

## 0.2.0 - 2026-11-17
First public release. Rebuilt on the verified 0.1.0 starter; every offline capability was preserved and the unsafe or incomplete parts were fixed.

### Added
- **Multi-document YAML and JSON (`List`/array)** with identity reconciliation: resources are matched by group/kind/namespace/name; added and removed resources are reported (rule `DS-K8S-019`).
- **Exact source maps**: findings and diffs carry the real line from the parser (`lineConfidence: exact | parent | unknown`); no invented lines.
- **Semantic diff over the whole object** (all containers matched by name, env, volumes, RBAC, annotations) instead of 10 hard-coded paths, with redaction of Secret data, password-named keys and secret-like env values.
- Rules `DS-K8S-012..019`: inline secret-like env literals, hostPID/hostIPC, hostPath, dangerous capabilities, missing readinessProbe, non-root not enforced, RBAC read of Secrets, resource removed. CronJob and initContainers are now covered.
- **Policy profiles** `development | staging | production` (explicit choice recorded in the report). Persistent HIGH risk now blocks; before, only newly introduced HIGH findings did.
- **BlastMap**: Service→workload, Ingress→Service, workload→ConfigMap/Secret/PVC/ServiceAccount, binding→role/subject edges derived only from supplied manifests; everything else is `UNKNOWN`.
- `deploysutra audit`: independent self-audit written as **Markdown, HTML and JSON**. Also HTML/MD/JSON for every analysis report; new accessible, self-contained HTML (light/dark, print, no JS).
- `rules`, `explain`, `--fail-on`, `--profile`, `--format`, `--version` CLI additions; **MCP server** (`deploysutra mcp`) with six read-only tools.
- OpenTofu summary: replacement detection, per-type action table, data-bearing destructive detection (gate `BLOCKED`), truncation flag, names of discarded sensitive sections.
- 25 skills and 20 agent files rewritten from one table: each states when to use it, when not to, and which command and rule IDs back it; tests verify the references are real.
- 50-case labelled rule corpus, proof artifacts in `docs/proof/`, a complete documentation set in `documents/DeploySutra-AI/` (outside the package), CITATION, NOTICE, SUPPORT, llms.txt, release workflow.

### Fixed
- `canonical()` was unused and report digests depended on key insertion order: seals now use deterministic recursive key sorting.
- Plan import silently truncated to 1000 changes; it now says so (`truncated`, check `PARTIAL_TRUNCATED`).
- Image check misread registry ports (`host:5000/app`) as tags.
- YAML parser rejected `[]`, `{}`, `verbs: ["get"]` and URLs containing `&`; quoted values with trailing comments failed.
- The CLI crashed on a flag without a value and had an unused import indirection.
- Windows test failures when the OS user cannot create symlinks: such tests are now skipped and reported as skipped, not failed.
- Report Markdown could be broken by `|`, backticks or newlines in manifest strings.

### Changed
- `schemaVersion` is now `2.0` (report shape). Rule IDs `DS-K8S-001..011` and their meaning are unchanged.
- Package renamed to the publishable `deploysutra-ai`; `private` removed.

## 0.1.0 - offline starter
Constrained YAML/JSON reader, 11 rules, rollback checklist, sanitized OpenTofu summary, sealed reports, localhost API, skills installer.
