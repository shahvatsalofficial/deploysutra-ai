# Default read-only behavior

**Rule:** `00-default-readonly` · **Maintainer:** Vatsal Shah

Do not execute deployment, installation, network queries, cluster changes, restarts, mutations or shell scripts from untrusted repo. Ask for explicit scope and approval before every sensitive action.

**Implementation requirement:** enforce in CLI, server, host adapter and documentation as applicable. In security tests, prove unauthorized or unsupported paths are rejected rather than relying only on text instructions. Produce a stable finding if a policy is missing or untested.

**Evidence obligation:** include test output, source reference and `not_run` where a claim cannot be checked. No policy rule grants deployment authorization.
