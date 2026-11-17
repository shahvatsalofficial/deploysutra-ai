# Truthful evidence statuses

**Rule:** `03-evidence-status` · **Maintainer:** Vatsal Shah

Every check is labeled VERIFIED_STATIC, DECLARED_NOT_VERIFIED, NOT_TESTED, NOT_RUN, FAILED or UNKNOWN. No unobserved success claims.

**Implementation requirement:** enforce in CLI, server, host adapter and documentation as applicable. In security tests, prove unauthorized or unsupported paths are rejected rather than relying only on text instructions. Produce a stable finding if a policy is missing or untested.

**Evidence obligation:** include test output, source reference and `not_run` where a claim cannot be checked. No policy rule grants deployment authorization.
