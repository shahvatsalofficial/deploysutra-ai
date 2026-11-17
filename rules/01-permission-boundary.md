# Human authorization and least privilege

**Rule:** `01-permission-boundary` · **Maintainer:** Vatsal Shah

Human operators retain full release and rollback control. A model verdict is never release authorization. Server tokens are scoped, short lived and protected.

**Implementation requirement:** enforce in CLI, server, host adapter and documentation as applicable. In security tests, prove unauthorized or unsupported paths are rejected rather than relying only on text instructions. Produce a stable finding if a policy is missing or untested.

**Evidence obligation:** include test output, source reference and `not_run` where a claim cannot be checked. No policy rule grants deployment authorization.
