# Third-party notices

## Bundled code

None. `package.json` declares no `dependencies` or `devDependencies`. Everything runs on the Node.js standard library (`node:fs`, `node:path`, `node:crypto`, `node:http`, `node:readline`, `node:test`, `node:child_process` in the audit runner only).

## Referenced standards and optional tools (not bundled, not required)

| Item | Role | Where |
|---|---|---|
| Kubernetes API objects | Input format (manifests); no client library, no cluster access | docs/ARCHITECTURE.md |
| OpenTofu / Terraform plan JSON (`show -json`) | Input format; only action summaries are retained | docs/THREAT_MODEL.md |
| Agent Skills `SKILL.md` convention | Layout of `skills/` | docs/IDE_COMPATIBILITY.md |
| Model Context Protocol | Wire format of `deploysutra mcp` (hand-implemented subset: initialize, ping, tools/list, tools/call) | packages/server/mcp.mjs |
| OPA/Conftest, kubeconform, Trivy, Cosign, Helm, Kustomize, Argo CD | Planned optional adapters only; not installed, not called | docs/PLUGIN_AND_TOOL_CATALOG.md |

Each item's license and trademark belong to its owners. Review them before you add any of these to your own pipeline.
