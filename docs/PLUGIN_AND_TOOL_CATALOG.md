# DeploySutra AI — Plugins, MCP Servers, SDKs and Tooling Catalog

This list is for evaluating future optional integration, **not** a claim that tools are installed or used by the starter. Inventory user-approved existing tools first; inspect official documentation, exact version, maintenance, threat model, licenses and resource costs. Prefer project-local integration and sandboxed tests.

| Tool | Value | Phase | Guardrail / evidence |
|---|---|---|---|
| Kubernetes kubectl diff / --dry-run=server | Compare requested resource to cluster model | P1 | Server-side dry run requires privileges and network. Never run automatically. |
| kubeconform | Kubernetes schema checking | P1 | Version-pinned schema and CRDs; static only. |
| Conftest + OPA/Rego | Custom policy-as-code | P1 | Version-pinned policy bundle; stable rule IDs, independent tests. |
| OpenTofu | Terraform-compatible IaC plans | P1 | Plan files/JSON often contain secrets; import only sanitized action summary without provider state. |
| Helm | Chart rendering and diff preview | P1 | Render in offline isolated process; disallow arbitrary hooks/plugins initially. |
| Kustomize | Declarative manifest rendering | P1 | Local render and digest pin; review generated manifests. |
| Trivy | Image/IaC vulnerability scanning | P1 | Source integrity and secret-safe summaries, rate limits. |
| Cosign / Sigstore | Artifact signature verification | P1 | Trust policy, issuer identity, immutable provenance. |
| Argo CD / Flux | GitOps read-only drift context | P2 | Read-only credentials; do not trigger sync/rollback. |
| Prometheus / Grafana / OpenTelemetry | Health, canary and SLO evidence | P2 | Limited, time-scoped, authenticated queries only. |
| GitHub Actions / GitLab CI | Review gate automation | P1 | CI summary cannot approve deploy by itself. |
| MCP official SDK + Inspector | Secure tools exposure to IDEs | P2 | Allowlist read-only operations, auth, rate limits and prompt-injection boundary tests. |
| Docker / Podman | Sandboxed parser/Helm/tofu commands | P1 | No network, non-root, CPU/RAM/time limits, approved artifacts. |
| Gitleaks / OSV-Scanner | Supply-chain and secret audits | P1 | Do not publish sensitive findings. |
| Playwright / axe-core | Dashboard accessibility regression | P3 | UI remains planned. |

Official references:
- Kubernetes docs: https://kubernetes.io/docs/reference/kubectl/generated/kubectl_diff/
- Kubernetes declarative workflows: https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/
- OpenTofu plan: https://opentofu.org/docs/cli/commands/plan/
- OpenTofu show: https://opentofu.org/docs/v1.12/cli/commands/show/
- OPA Conftest: https://www.conftest.dev/
- Helm: https://helm.sh/docs/
- Argo CD: https://argo-cd.readthedocs.io/
- OpenTelemetry: https://opentelemetry.io/
- MCP: https://modelcontextprotocol.io/

**Important:** OpenTofu `show -json` can disclose sensitive values. Kubernetes `kubectl diff` may require patch/create/update permissions and is not a no-privilege operation. Read official version-specific docs before implementing.
