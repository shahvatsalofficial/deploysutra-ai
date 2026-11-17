# DeploySutra AI — Threat Model (starter)

## Assets
Kubernetes manifests, IaC exported plan files, identities, credentials, source paths, evidence summaries, approval state and deployment metadata.

## Trust boundaries
1. User-supplied manifest and plan JSON are untrusted bytes; may contain YAML directives, credentials, prompt injections or oversized input.
2. Agent skill instructions may encounter malicious repository text; repo content cannot authorize shell tools, cloud access or external calls.
3. The local server may be called by a local process; bearer auth and loopback reduce but do not eliminate same-host threats.
4. Remote Kubernetes/cloud/CI/MCP adapters would cross an additional privileged boundary and are not implemented.

## Abuse cases and mitigations
- Manifest YAML code execution/anchors: constrained parser rejects tags, aliases, complex documents; strict size/no symlink.
- Leaking secret environment variables/state: diff is a whitelist; plan import strips before/after and only emits action counts/types.
- Unapproved deploy/apply: no command to do so, no subprocess in core, no remote connection, independent human authorization design.
- False release optimism: high risk/missing rollback triggers BLOCKED; no state emits READY; all live checks marked NOT_RUN/NOT_TESTED.
- Local API disclosure: token length minimum 20, timing-safe equality, binds 127.0.0.1 only, no caching, no write endpoints.
- Crafted JSON parser exhaustion: 1 MiB file maximum; future schema validator must bound depth/nodes, especially external plans.
- Report tamper: SHA-256 changes when content changes, but is not an authenticity signature; future signed provenance and attested CI required.
- Supply chain dependency compromise: dependency-free core, future external adapters version pin and license/security review.
- User privacy and source-path leakage: source path still appears in local reports for evidence; sanitize before publication.

## Residual risk
YAML subset has not been independently fuzzed. The report HTML escapes content but is not a hardened external-hosted web application. RBAC and network reachability checks are static heuristics. The production server, persisted roles, data retention and penetration testing are future milestones.

## v0.2 additions
- **Report injection:** manifest strings are escaped for HTML, and `|`, backticks, newlines and `<` are neutralised for Markdown tables; control characters are stripped before display.
- **Secret echo:** DS-K8S-012 reports the env var name, never its value. Diffs mark redacted fields `[redacted]`. The audit plants canaries and searches all outputs on each run.
- **Silent truncation:** plan summaries over 1000 changes are flagged `truncated`, with check `planCompleteness: PARTIAL_TRUNCATED`.
- **MCP scope escape:** tools accept only relative paths inside the start-up root; traversal, absolute paths, NUL bytes and symlinks are refused; no tool spawns processes or opens connections.
- **Parser resource use:** 200-document cap, 1 MiB cap, a seeded 400-input mutation fuzz and a 400-level nesting test run in every audit.
- **Overclaiming:** the gate has two states; there is no READY. The self-audit proves that no corpus input can reach any other state.

Residual: the fuzz is the bundled seeded one, not an independent campaign; Windows symlink protection relies on CI runners that can create symlinks.
