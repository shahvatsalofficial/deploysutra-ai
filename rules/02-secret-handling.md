# Secrets and sensitive plan data

**Rule:** `02-secret-handling` · **Maintainer:** Vatsal Shah

Never echo kubeconfig, .env secrets, OpenTofu before/after, token or state payload. Sensitive inputs remain local and must not be stored in reports. Scrub logs.

**Implementation requirement:** enforce in CLI, server, host adapter and documentation as applicable. In security tests, prove unauthorized or unsupported paths are rejected rather than relying only on text instructions. Produce a stable finding if a policy is missing or untested.

**Evidence obligation:** include test output, source reference and `not_run` where a claim cannot be checked. No policy rule grants deployment authorization.
