# Legal, licensing and trust notes

*This is an engineering transparency note, not legal advice. Consult a lawyer before relying on it.*

## License
Apache License 2.0 (see `LICENSE`). Copyright 2026 Vatsal Shah. `NOTICE` carries the attribution that must be preserved in redistributions. There are **no runtime or development dependencies**, so there are no third-party licenses to pass through (`THIRD_PARTY_NOTICES.md`).

## No warranty, no certification
The software is provided "as is". A DeploySutra report is advisory static analysis of files you supplied. It is **not**:
- a deployment approval (the gate has no READY state),
- a security audit or penetration test,
- a compliance certification (SOC 2, ISO 27001, PCI, HIPAA and similar are not claimed or assessed),
- proof of live state, network reachability, IAM scope or data recoverability.

## Trademarks and names
Kubernetes, Helm, OpenTofu, Terraform, Argo CD, Trivy, Cosign, OPA, Claude Code, Cursor, Codex, Gemini, GitHub Copilot and others are trademarks of their owners, used for identification only; no affiliation or endorsement is implied. The name "DeploySutra" has **not** been through a trademark or domain clearance. The npm package name `deploysutra-ai` was free when published; availability on other registries and domains was not checked. Do not treat the name as legally unique.

## Data handling and privacy
- Runs entirely on your machine. No network calls, no telemetry, no account, no API key.
- Input files are read, never modified. Reports are written only where you point `--out`.
- Secret-like env literals, Secret `data`, password-named keys and all IaC plan state are redacted or discarded before they reach any output. The self-audit proves this with canary strings on every run.
- Reports can still contain resource names, namespaces, file names and image references. Share them like you would a diff of your infrastructure.
- OpenTofu/Terraform plan JSON can contain cleartext secrets even when the terminal masks them. Keep the input private and delete it after use.

## Export and regulated environments
No cryptography is used other than SHA-256 hashing from the Node.js standard library. No encryption is implemented. If your organisation restricts use of open-source tooling, check it against your policy.

## Trust and provenance
- Source: https://github.com/shahvatsalofficial/deploysutra-ai (public, Apache-2.0).
- npm releases are published from GitHub Actions with provenance when the trusted-publisher link is configured; a manual publish carries no provenance, and the release notes say which one was used.
- Reports carry an **unkeyed SHA-256 seal**. It proves a report was not edited relative to a trusted copy; it does not prove who made it. Signed provenance (explicit trust root and key rotation) is planned, not implemented.

## Responsible disclosure
See `SECURITY.md`. Use a private GitHub security advisory. Do not include live credentials in issues.

## Authorship
Created and maintained by Vatsal Shah (`shahvatsalofficial`). AI assistance was used in development; every claim in this repository is meant to be verifiable by running the code (`npm test`, `deploysutra audit`).
