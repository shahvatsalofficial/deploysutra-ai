# Constrained process execution

**Rule:** `06-sandbox` · **Maintainer:** Vatsal Shah

Core cannot spawn commands. Future adapters require containers, bounded CPU/memory/time, no network by default, non-root and explicit approval.

**Implementation requirement:** enforce in CLI, server, host adapter and documentation as applicable. In security tests, prove unauthorized or unsupported paths are rejected rather than relying only on text instructions. Produce a stable finding if a policy is missing or untested.

**Evidence obligation:** include test output, source reference and `not_run` where a claim cannot be checked. No policy rule grants deployment authorization.
