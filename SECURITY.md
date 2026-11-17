# Security Policy

## Reporting a vulnerability
Use a **private GitHub security advisory**: https://github.com/shahvatsalofficial/deploysutra-ai/security/advisories/new. Do not open a public issue for an unfixed vulnerability, and never include live credentials, kubeconfigs or plan state. Expect an acknowledgement within a few days; this is a volunteer-maintained project without an SLA.

Supported versions: the latest 0.x release.

## Trust boundaries
- Manifest and plan input is **untrusted**. The core never runs shell commands, never contacts a cluster or cloud, and never evaluates input as code.
- The YAML reader is a strict subset: it rejects tabs, odd indentation, anchors, aliases, tags, merge keys, block scalars, nested flow collections, templates, `...` and duplicate or unsafe keys. It never skips what it cannot read.
- Files must be regular, non-symlink, under 1 MiB, with no symlinked parent directory. At most 200 documents per file.
- Secret-like env literals, Secret `data` and IaC plan state never reach output; the self-audit checks this with canaries on every run.
- The optional report server binds only to loopback, requires a bearer token of 20+ characters, compares in constant time, serves a preloaded checksum-verified report and refuses every non-GET method. It is a local demo service, not a hardened multi-user product: no TLS, no RBAC, no tenancy.
- The MCP server is read-only, scoped to one workspace directory chosen at start-up, takes only relative paths, refuses traversal, absolute paths and symlinks, and exposes no tool that can spawn processes or open network connections.

## Safety limitations
No policy checker proves a deployment is safe. A SHA-256 seal is not a signature. No rollback is validated until a human observes restoration. A real `kubectl diff` or server-side dry run needs permissions and must stay an explicitly approved future adapter. OpenTofu/Terraform JSON can contain cleartext secrets; keep it private.

## Known residual risks
- The YAML subset has been fuzzed only by the bundled seeded mutation test, not by an independent party.
- HTML reports escape all untrusted text and ship no scripts, but are not a hardened public web application.
- Windows symlink behaviour is covered by CI on runners that can create symlinks; developer machines without that right skip those tests (and say so).
