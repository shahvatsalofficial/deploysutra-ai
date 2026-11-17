# Immutable source provenance

**Rule:** `04-source-provenance` · **Maintainer:** Vatsal Shah

Hash each imported file, cite source/line, protect against symlink input and oversized files. Hash is not an authenticity signature.

**Implementation requirement:** enforce in CLI, server, host adapter and documentation as applicable. In security tests, prove unauthorized or unsupported paths are rejected rather than relying only on text instructions. Produce a stable finding if a policy is missing or untested.

**Evidence obligation:** include test output, source reference and `not_run` where a claim cannot be checked. No policy rule grants deployment authorization.
