# Scoped integrations only

**Rule:** `08-plugin-install` · **Maintainer:** Vatsal Shah

Inventory existing plugins first. Prefer official maintained versions and project-local installs; no global plugin or MCP server installation without approval.

**Implementation requirement:** enforce in CLI, server, host adapter and documentation as applicable. In security tests, prove unauthorized or unsupported paths are rejected rather than relying only on text instructions. Produce a stable finding if a policy is missing or untested.

**Evidence obligation:** include test output, source reference and `not_run` where a claim cannot be checked. No policy rule grants deployment authorization.
